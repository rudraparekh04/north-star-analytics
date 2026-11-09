"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationSession } from "@/app/lib/auth";
import { getPostgresPool } from "@/app/lib/database";

const uuidPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireCustomerEditor() {
  const session = await requireOrganizationSession();
  if (session.organization.role === "viewer") redirect("/forbidden");
  return session;
}

function readCustomerForm(formData: FormData) {
  const name = formData.get("name");
  const email = formData.get("email");
  const phone = formData.get("phone");
  const company = formData.get("company");
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof phone !== "string" ||
    typeof company !== "string"
  ) return null;

  const customer = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    company: company.trim(),
  };
  if (
    customer.name.length < 2 || customer.name.length > 100 ||
    customer.email.length > 254 || !emailPattern.test(customer.email) ||
    customer.phone.length > 40 || customer.company.length > 120
  ) return null;
  return customer;
}

function revalidateCustomerViews(customerId?: string) {
  revalidatePath("/customers", "page");
  revalidatePath("/orders", "page");
  revalidatePath("/", "page");
  if (customerId) revalidatePath(`/customers/${customerId}`, "page");
}

export async function createCustomerAction(formData: FormData) {
  const session = await requireCustomerEditor();
  const customer = readCustomerForm(formData);
  if (!customer) redirect("/customers?error=invalid");
  const pool = getPostgresPool();
  const existing = await pool.query<{ id: string; archived_at: Date | null }>(
    `SELECT id, archived_at FROM dashboard_customers
     WHERE organization_id = $1 AND lower(email) = $2`,
    [session.organization.id, customer.email],
  );
  const match = existing.rows[0];
  if (match && !match.archived_at) redirect("/customers?error=duplicate");

  const result = match
    ? await pool.query<{ id: string }>(
      `WITH saved AS (
         UPDATE dashboard_customers
         SET full_name = $3, email = $4, phone = $5, company = $6,
             archived_at = NULL, updated_at = now()
         WHERE organization_id = $1 AND id = $2
         RETURNING id
       ),
       updated_orders AS (
         UPDATE dashboard_transactions t
         SET customer = $3, email = $4
         FROM saved
         WHERE t.organization_id = $1 AND t.customer_id = saved.id
         RETURNING t.id
       ),
       activity AS (
         INSERT INTO dashboard_customer_activity
           (organization_id, customer_id, event_type, description)
         SELECT $1, id, 'customer_restored', 'Customer profile restored' FROM saved
         RETURNING id
       )
       SELECT id FROM saved`,
      [session.organization.id, match.id, customer.name, customer.email, customer.phone, customer.company],
    )
    : await pool.query<{ id: string }>(
      `WITH saved AS (
         INSERT INTO dashboard_customers (organization_id, full_name, email, phone, company)
         VALUES ($1, $2, $3, $4, $5) RETURNING id
       ),
       activity AS (
         INSERT INTO dashboard_customer_activity
           (organization_id, customer_id, event_type, description)
         SELECT $1, id, 'customer_created', 'Customer profile created' FROM saved
         RETURNING id
       )
       SELECT id FROM saved`,
      [session.organization.id, customer.name, customer.email, customer.phone, customer.company],
    );
  const customerId = result.rows[0]?.id;
  if (!customerId) throw new Error("The customer profile could not be saved.");
  revalidateCustomerViews(customerId);
  redirect(`/customers/${customerId}?updated=1`);
}

export async function updateCustomerAction(formData: FormData) {
  const session = await requireCustomerEditor();
  const customerId = formData.get("customerId");
  const customer = readCustomerForm(formData);
  if (typeof customerId !== "string" || !uuidPattern.test(customerId)) redirect("/customers?error=invalid");
  if (!customer) redirect(`/customers/${customerId}?error=invalid`);

  const pool = getPostgresPool();
  const duplicate = await pool.query<{ id: string }>(
    `SELECT id FROM dashboard_customers
     WHERE organization_id = $1 AND lower(email) = $2 AND id <> $3`,
    [session.organization.id, customer.email, customerId],
  );
  if (duplicate.rows.length) redirect(`/customers/${customerId}?error=duplicate`);

  const result = await pool.query<{ id: string }>(
    `WITH saved AS (
       UPDATE dashboard_customers
       SET full_name = $3, email = $4, phone = $5, company = $6, updated_at = now()
       WHERE organization_id = $1 AND id = $2 AND archived_at IS NULL
       RETURNING id
     ),
     updated_orders AS (
       UPDATE dashboard_transactions t
       SET customer = $3, email = $4
       FROM saved
       WHERE t.organization_id = $1 AND t.customer_id = saved.id
       RETURNING t.id
     ),
     activity AS (
       INSERT INTO dashboard_customer_activity
         (organization_id, customer_id, event_type, description)
       SELECT $1, id, 'customer_updated', 'Customer profile updated' FROM saved
       RETURNING id
     )
     SELECT id FROM saved`,
    [session.organization.id, customerId, customer.name, customer.email, customer.phone, customer.company],
  );
  if (result.rowCount !== 1) redirect("/customers?error=customer");
  revalidateCustomerViews(customerId);
  redirect(`/customers/${customerId}?updated=1`);
}

export async function archiveCustomerAction(formData: FormData) {
  const session = await requireCustomerEditor();
  const customerId = formData.get("customerId");
  if (typeof customerId !== "string" || !uuidPattern.test(customerId)) redirect("/customers?error=invalid");

  const result = await getPostgresPool().query<{ id: string }>(
    `WITH archived AS (
       UPDATE dashboard_customers
       SET archived_at = now(), updated_at = now()
       WHERE organization_id = $1 AND id = $2 AND archived_at IS NULL
       RETURNING id
     ),
     activity AS (
       INSERT INTO dashboard_customer_activity
         (organization_id, customer_id, event_type, description)
       SELECT $1, id, 'customer_archived',
         'Customer profile archived; order history retained' FROM archived
       RETURNING id
     )
     SELECT id FROM archived`,
    [session.organization.id, customerId],
  );
  if (result.rowCount !== 1) redirect("/customers?error=customer");
  revalidateCustomerViews(customerId);
  redirect("/customers?updated=archived");
}

export async function restoreCustomerAction(formData: FormData) {
  const session = await requireCustomerEditor();
  const customerId = formData.get("customerId");
  if (typeof customerId !== "string" || !uuidPattern.test(customerId)) redirect("/customers?error=invalid");

  const result = await getPostgresPool().query<{ id: string }>(
    `WITH restored AS (
       UPDATE dashboard_customers
       SET archived_at = NULL, updated_at = now()
       WHERE organization_id = $1 AND id = $2 AND archived_at IS NOT NULL
       RETURNING id
     ),
     activity AS (
       INSERT INTO dashboard_customer_activity
         (organization_id, customer_id, event_type, description)
       SELECT $1, id, 'customer_restored', 'Customer profile restored' FROM restored
       RETURNING id
     )
     SELECT id FROM restored`,
    [session.organization.id, customerId],
  );
  if (result.rowCount !== 1) redirect("/customers?error=customer");
  revalidateCustomerViews(customerId);
  redirect(`/customers/${customerId}?updated=1`);
}
