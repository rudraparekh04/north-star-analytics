import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPostgresPool } from "@/app/lib/database";
import { ensureAppSchema } from "@/app/lib/schema";
import type { UserRole } from "@/app/types/dashboard";

export const roles = ["admin", "analyst", "viewer"] as const satisfies readonly UserRole[];

export interface OrganizationMembership {
  id: string;
  name: string;
  slug: string;
  role: UserRole;
}

export interface AuthSession {
  userId: string;
  fullName: string;
  email: string;
  organization: OrganizationMembership | null;
}

export class SessionConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionConfigurationError";
  }
}

const cookieName = "northstar_session";
const organizationCookieName = "northstar_organization";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 14;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new SessionConfigurationError(
      "Set SESSION_SECRET to a random value of at least 32 characters before enabling account sign-in.",
    );
  }
  return secret;
}

export async function createSession(userId: string, organizationId: string | null) {
  const secret = getSessionSecret();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(`${secret}:${token}`).digest("hex");
  const pool = getPostgresPool();
  await pool.query(
    `INSERT INTO dashboard_sessions (token_hash, user_id, organization_id, expires_at)
     VALUES ($1, $2, $3, now() + ($4 * interval '1 second'))`,
    [tokenHash, userId, organizationId, sessionMaxAgeSeconds],
  );
  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  if (organizationId) {
    cookieStore.set(organizationCookieName, organizationId, {
      httpOnly: true,
      maxAge: sessionMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    cookieStore.delete(organizationCookieName);
  }
}

export async function getSessionIdentity() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const pool = getPostgresPool();
  await ensureAppSchema();
  const tokenHash = createHash("sha256")
    .update(`${getSessionSecret()}:${token}`)
    .digest("hex");
  const result = await pool.query<{
    user_id: string;
    full_name: string;
    email: string;
  }>(
    `SELECT u.id AS user_id, u.full_name, u.email
     FROM dashboard_sessions s
     JOIN dashboard_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  const user = result.rows[0];
  return user ? { userId: user.user_id, fullName: user.full_name, email: user.email, tokenHash } : null;
}

export async function getOrganizationMemberships(userId: string) {
  const pool = getPostgresPool();
  await ensureAppSchema();
  const result = await pool.query<OrganizationMembership>(
    `SELECT o.id, o.name, o.slug, m.role
     FROM dashboard_memberships m
     JOIN dashboard_organizations o ON o.id = m.organization_id
     WHERE m.user_id = $1 AND m.status = 'active'
     ORDER BY o.name`,
    [userId],
  );
  return result.rows;
}

export async function getSession(): Promise<AuthSession | null> {
  const identity = await getSessionIdentity();
  if (!identity) return null;
  const pool = getPostgresPool();
  const organizationId = (await cookies()).get(organizationCookieName)?.value;
  if (!organizationId) {
    return {
      userId: identity.userId,
      fullName: identity.fullName,
      email: identity.email,
      organization: null,
    };
  }

  const result = await pool.query<OrganizationMembership>(
    `SELECT o.id, o.name, o.slug, m.role
     FROM dashboard_sessions s
     JOIN dashboard_memberships m
       ON m.user_id = s.user_id AND m.organization_id = $3 AND m.status = 'active'
     JOIN dashboard_organizations o ON o.id = m.organization_id
     WHERE s.token_hash = $1 AND s.user_id = $2 AND s.expires_at > now()
       AND s.organization_id = m.organization_id`,
    [identity.tokenHash, identity.userId, organizationId],
  );
  return {
    userId: identity.userId,
    fullName: identity.fullName,
    email: identity.email,
    organization: result.rows[0] ?? null,
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export async function requireOrganizationSession() {
  const session = await requireSession();
  if (!session.organization) {
    const memberships = await getOrganizationMemberships(session.userId);
    redirect(memberships.length ? "/select-organization" : "/access-pending");
  }
  return { ...session, organization: session.organization };
}

export async function clearSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (token) {
    const identity = await getSessionIdentity();
    if (identity) {
      await getPostgresPool().query(
        "DELETE FROM dashboard_sessions WHERE token_hash = $1",
        [identity.tokenHash],
      );
    }
  }
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
  cookieStore.delete(organizationCookieName);
}

export async function selectSessionOrganization(organizationId: string) {
  const identity = await getSessionIdentity();
  if (!identity) return false;
  const result = await getPostgresPool().query(
    `UPDATE dashboard_sessions s
     SET organization_id = $3
     WHERE s.token_hash = $1 AND s.user_id = $2 AND s.expires_at > now()
       AND EXISTS (
         SELECT 1 FROM dashboard_memberships m
         WHERE m.user_id = s.user_id AND m.organization_id = $3 AND m.status = 'active'
       )`,
    [identity.tokenHash, identity.userId, organizationId],
  );
  if (result.rowCount !== 1) return false;
  (await cookies()).set(organizationCookieName, organizationId, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return true;
}

export async function requireAdminSession() {
  const session = await requireOrganizationSession();
  if (session.organization.role !== "admin") redirect("/forbidden");
  return session;
}
