"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import {
  clearSession,
  createSession,
  getOrganizationMemberships,
  requireAdminSession,
  roles,
  selectSessionOrganization,
} from "@/app/lib/auth";
import type { UserRole } from "@/app/types/dashboard";
import { getPostgresPool } from "@/app/lib/database";
import { ensureAppSchema } from "@/app/lib/schema";

export interface AuthFormState {
  error?: string;
  message?: string;
}

const dummyPasswordHash = bcrypt.hashSync(
  `northstar-invalid-password-${randomBytes(32).toString("hex")}`,
  12,
);

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidPassword(password: string) {
  return password.length >= 12 && Buffer.byteLength(password, "utf8") <= 72;
}

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = formString(formData, "name").trim();
  const email = normalizeEmail(formString(formData, "email"));
  const password = formString(formData, "password");
  const organizationSlug = formString(formData, "organization").trim().toLowerCase();

  if (name.length < 2 || name.length > 60) return { error: "Enter a name between 2 and 60 characters." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!isValidPassword(password)) return { error: "Use a password of 12–72 UTF-8 bytes." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) return { error: "Choose an organization from the list." };

  await ensureAppSchema();
  const pool = getPostgresPool();
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  let user: { id: string; full_name: string; email: string } | undefined;

  try {
    await client.query("BEGIN");
    const organization = await client.query<{ id: string }>(
      "SELECT id FROM dashboard_organizations WHERE slug = $1",
      [organizationSlug],
    );
    if (!organization.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "That organization is not available. Ask its administrator for the correct workspace." };
    }
    const inserted = await client.query<{
      id: string;
      full_name: string;
      email: string;
    }>(
      `INSERT INTO dashboard_users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, full_name, email`,
      [name, email, passwordHash],
    );
    user = inserted.rows[0];
    if (!user) {
      const existing = await client.query<NonNullable<typeof user>>(
        "SELECT id, full_name, email FROM dashboard_users WHERE email = $1",
        [email],
      );
      user = existing.rows[0];
    }
    if (!user) throw new Error("Unable to resolve the account after registration.");

    await client.query(
      `INSERT INTO dashboard_memberships (organization_id, user_id, role, status)
       VALUES ($1, $2, 'viewer', 'pending')
       ON CONFLICT (organization_id, user_id) DO UPDATE
       SET status = 'pending', updated_at = now()
       WHERE dashboard_memberships.status = 'rejected'`,
      [organization.rows[0].id, user.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    message: "Account created. Your access request is pending approval by an organization administrator.",
  };
}

export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = normalizeEmail(formString(formData, "email"));
  const password = formString(formData, "password");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length > 1024) {
    return { error: "Email or password is incorrect." };
  }

  await ensureAppSchema();
  const pool = getPostgresPool();
  const throttle = await pool.query<{ failed_count: number }>(
    `SELECT failed_count FROM dashboard_login_attempts
     WHERE email = $1 AND window_started_at > now() - interval '15 minutes'`,
    [email],
  );
  if ((throttle.rows[0]?.failed_count ?? 0) >= 8) {
    return { error: "Too many sign-in attempts. Try again in 15 minutes." };
  }

  const result = await pool.query<{
    id: string;
    password_hash: string;
  }>(
    "SELECT id, password_hash FROM dashboard_users WHERE email = $1",
    [email],
  );
  const user = result.rows[0];
  const passwordMatches = await bcrypt.compare(password, user?.password_hash ?? dummyPasswordHash);
  if (!user || !passwordMatches) {
    const failure = await pool.query<{ failed_count: number }>(
      `INSERT INTO dashboard_login_attempts (email, failed_count, window_started_at)
       VALUES ($1, 1, now())
       ON CONFLICT (email) DO UPDATE
       SET failed_count = CASE
             WHEN dashboard_login_attempts.window_started_at <= now() - interval '15 minutes' THEN 1
             ELSE dashboard_login_attempts.failed_count + 1
           END,
           window_started_at = CASE
             WHEN dashboard_login_attempts.window_started_at <= now() - interval '15 minutes' THEN now()
             ELSE dashboard_login_attempts.window_started_at
           END
       RETURNING failed_count`,
      [email],
    );
    return failure.rows[0].failed_count >= 8
      ? { error: "Too many sign-in attempts. Try again in 15 minutes." }
      : { error: "Email or password is incorrect." };
  }

  await pool.query("DELETE FROM dashboard_login_attempts WHERE email = $1", [email]);
  const memberships = await getOrganizationMemberships(user.id);
  if (!memberships.length) redirect("/access-pending");
  if (memberships.length === 1) {
    await createSession(user.id, memberships[0].id);
    redirect("/");
  }
  await createSession(user.id, null);
  redirect("/select-organization");
}

export async function signOutAction() {
  await clearSession();
  redirect("/sign-in");
}

export async function selectOrganizationAction(formData: FormData) {
  const organizationId = formString(formData, "organizationId");
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(organizationId)) redirect("/select-organization");
  if (!await selectSessionOrganization(organizationId)) redirect("/select-organization?error=membership");
  redirect("/");
}

export async function switchOrganizationAction(formData: FormData) {
  const organizationId = formString(formData, "organizationId");
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(organizationId)) redirect("/?error=organization");
  if (!await selectSessionOrganization(organizationId)) redirect("/?error=organization");
  redirect("/");
}

export async function updateMembershipAction(formData: FormData) {
  const admin = await requireAdminSession();
  const userId = formString(formData, "userId");
  const action = formString(formData, "action");
  const requestedRole = formString(formData, "role");
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(userId)) redirect("/admin?error=member");
  const pool = getPostgresPool();
  const client = await pool.connect();
  let actionError: string | null = null;
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT id FROM dashboard_organizations WHERE id = $1 FOR UPDATE",
      [admin.organization.id],
    );
    const membership = await client.query<{
      role: UserRole;
      status: string;
    }>(
      `SELECT m.role, m.status
       FROM dashboard_memberships m
       WHERE m.organization_id = $1 AND m.user_id = $2 FOR UPDATE`,
      [admin.organization.id, userId],
    );
    const target = membership.rows[0];
    if (!target) {
      actionError = "member";
    } else if (action === "approve" || action === "reject") {
      if (action === "reject" && target.role === "admin" && target.status === "active") {
        const admins = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM dashboard_memberships
           WHERE organization_id = $1 AND role = 'admin' AND status = 'active'`,
          [admin.organization.id],
        );
        if (Number(admins.rows[0]?.count) <= 1) actionError = "last-admin";
        else await client.query(
          `UPDATE dashboard_memberships SET status = 'rejected', updated_at = now()
           WHERE organization_id = $1 AND user_id = $2`,
          [admin.organization.id, userId],
        );
      } else {
        await client.query(
          `UPDATE dashboard_memberships
           SET status = $1, role = CASE WHEN $1 = 'active' THEN 'viewer' ELSE role END, updated_at = now()
           WHERE organization_id = $2 AND user_id = $3`,
          [action === "approve" ? "active" : "rejected", admin.organization.id, userId],
        );
      }
    } else if (action === "change-role" && roles.some((role) => role === requestedRole)) {
      if (target.role === "admin" && requestedRole !== "admin" && target.status === "active") {
        const admins = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count FROM dashboard_memberships
           WHERE organization_id = $1 AND role = 'admin' AND status = 'active'`,
          [admin.organization.id],
        );
        if (Number(admins.rows[0]?.count) <= 1) {
          actionError = "last-admin";
        }
      }
      if (!actionError) {
        await client.query(
          `UPDATE dashboard_memberships SET role = $1, updated_at = now()
           WHERE organization_id = $2 AND user_id = $3 AND status = 'active'`,
          [requestedRole as UserRole, admin.organization.id, userId],
        );
      }
    } else {
      actionError = "action";
    }
    if (actionError) await client.query("ROLLBACK");
    else await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (actionError) redirect(`/admin?error=${actionError}`);
  redirect("/admin?updated=1");
}

export async function resetMemberPasswordAction(formData: FormData) {
  const admin = await requireAdminSession();
  const userId = formString(formData, "userId");
  const password = formString(formData, "password");
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(userId)) redirect("/admin?error=member");
  if (!isValidPassword(password)) redirect("/admin?error=password");

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await getPostgresPool().connect();
  let memberExists = false;
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE dashboard_users u
       SET password_hash = $1
       WHERE u.id = $2
         AND EXISTS (
           SELECT 1 FROM dashboard_memberships m
           WHERE m.user_id = u.id AND m.organization_id = $3
         )`,
      [passwordHash, userId, admin.organization.id],
    );
    memberExists = result.rowCount === 1;
    if (memberExists) {
      await client.query(
        "DELETE FROM dashboard_sessions WHERE user_id = $1",
        [userId],
      );
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (!memberExists) redirect("/admin?error=member");
  redirect("/admin?passwordUpdated=1");
}

export async function createOrganizationAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await requireAdminSession();
  const name = formString(formData, "name").trim();
  const slug = formString(formData, "slug").trim().toLowerCase();
  if (name.length < 2 || name.length > 80) return { error: "Organization name must be 2–80 characters." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
    return { error: "Use a unique URL slug with lowercase letters, numbers, and hyphens." };
  }
  await ensureAppSchema();
  const client = await getPostgresPool().connect();
  try {
    await client.query("BEGIN");
    const organization = await client.query<{ id: string }>(
      `INSERT INTO dashboard_organizations (name, slug)
       VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING RETURNING id`,
      [name, slug],
    );
    const organizationId = organization.rows[0]?.id;
    if (!organizationId) {
      await client.query("ROLLBACK");
      return { error: "That organization slug is already in use." };
    }
    await client.query(
      `INSERT INTO dashboard_memberships (organization_id, user_id, role, status)
       VALUES ($1, $2, 'admin', 'active')`,
      [organizationId, session.userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const memberships = await getOrganizationMemberships(session.userId);
  const newOrganization = memberships.find((membership) => membership.slug === slug);
  if (newOrganization) {
    await selectSessionOrganization(newOrganization.id);
    redirect("/?organizationCreated=1");
  }
  return { error: "Organization was created, but the workspace could not be selected. Reload and try again." };
}
