import "server-only";

import { getPostgresPool } from "@/app/lib/database";
import { ensureAppSchema } from "@/app/lib/schema";

export interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
}

export async function getAvailableOrganizations() {
  await ensureAppSchema();
  const result = await getPostgresPool().query<OrganizationOption>(
    "SELECT id, name, slug FROM dashboard_organizations ORDER BY name",
  );
  return result.rows;
}

export interface OrganizationMember {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export async function getOrganizationMembers(organizationId: string) {
  await ensureAppSchema();
  const result = await getPostgresPool().query<OrganizationMember>(
    `SELECT u.id AS "userId", u.full_name AS "fullName", u.email,
       m.role, m.status
     FROM dashboard_memberships m
     JOIN dashboard_users u ON u.id = m.user_id
     WHERE m.organization_id = $1
     ORDER BY CASE m.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
       u.full_name`,
    [organizationId],
  );
  return result.rows;
}
