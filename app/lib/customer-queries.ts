import "server-only";

import { getPostgresPool } from "@/app/lib/database";
import { ensureTransactionSeedData } from "@/app/lib/transaction-queries";
import type {
  Customer,
  CustomerActivity,
  CustomerSegment,
  Transaction,
} from "@/app/types/dashboard";
import type { TransactionRow } from "@/app/lib/transaction-queries";

export interface CustomerDirectoryPage {
  customers: Customer[];
  total: number;
  page: number;
  pageSize: number;
  repeatCustomerPercentage: number;
}

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  segment: CustomerSegment;
  orderCount: number;
  lifetimeSpend: number;
  lastOrderAt: string | null;
  archivedAt: string | null;
  total: number;
}

const customerStats = `
  SELECT c.id, c.full_name AS name, c.email, c.phone, c.company, c.archived_at::text AS "archivedAt",
    COUNT(t.id)::int AS "orderCount",
    COALESCE(SUM(CASE
      WHEN t.status = 'Paid' THEN t.amount
      WHEN t.status = 'Refunded' THEN -t.amount
      ELSE 0
    END), 0)::float8 AS "lifetimeSpend",
    MAX(t.transaction_date)::text AS "lastOrderAt",
    COUNT(t.id) FILTER (WHERE t.status = 'Paid')::int AS paid_orders
  FROM dashboard_customers c
  LEFT JOIN dashboard_transactions t
    ON t.customer_id = c.id AND t.organization_id = c.organization_id
  WHERE c.organization_id = $1
  GROUP BY c.id`;

const classifiedCustomers = `
  SELECT customer_stats.*,
    CASE
      WHEN "lifetimeSpend" >= 1000 THEN 'High value'
      WHEN paid_orders >= 2 THEN 'Repeat'
      ELSE 'New'
    END AS segment
  FROM (${customerStats}) customer_stats`;

function formatCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    segment: row.segment,
    orderCount: row.orderCount,
    lifetimeSpend: row.lifetimeSpend,
    lastOrderAt: row.lastOrderAt,
    archivedAt: row.archivedAt,
  };
}

export async function getCustomerDirectory(
  organizationId: string,
  options: {
    search: string;
    segment: CustomerSegment | "";
    includeArchived: boolean;
    page: number;
    pageSize: number;
  },
): Promise<CustomerDirectoryPage> {
  await ensureTransactionSeedData(organizationId);
  const pool = getPostgresPool();
  const values: (string | number)[] = [organizationId];
  const conditions: string[] = [];

  if (!options.includeArchived) conditions.push(`"archivedAt" IS NULL`);
  if (options.search) {
    values.push(`%${options.search.slice(0, 100)}%`);
    const parameter = `$${values.length}`;
    conditions.push(`(name ILIKE ${parameter} OR email ILIKE ${parameter} OR company ILIKE ${parameter})`);
  }
  if (options.segment) {
    values.push(options.segment);
    conditions.push(`segment = $${values.length}`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM (${classifiedCustomers}) customers ${whereClause}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const pageSize = Math.min(Math.max(1, options.pageSize), 100);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, options.page), totalPages);
  const rows = await pool.query<CustomerRow>(
    `SELECT id, name, email, phone, company, segment, "orderCount", "lifetimeSpend",
       "lastOrderAt", "archivedAt", COUNT(*) OVER()::int AS total
     FROM (${classifiedCustomers}) customers
     ${whereClause}
     ORDER BY "lifetimeSpend" DESC, name ASC, id ASC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  const repeatResult = await pool.query<{ repeat_percentage: number }>(
    `SELECT COALESCE(
       COUNT(*) FILTER (WHERE paid_orders >= 2)::float8 /
       NULLIF(COUNT(*) FILTER (WHERE paid_orders >= 1), 0) * 100,
       0
     ) AS repeat_percentage
     FROM (${classifiedCustomers}) customers
     WHERE "archivedAt" IS NULL`,
    [organizationId],
  );

  return {
    customers: rows.rows.map(formatCustomer),
    total,
    page,
    pageSize,
    repeatCustomerPercentage: repeatResult.rows[0]?.repeat_percentage ?? 0,
  };
}

export interface CustomerDetail {
  customer: Customer;
  purchases: Transaction[];
  purchaseTotal: number;
  purchasePage: number;
  purchasePageSize: number;
  activity: CustomerActivity[];
}

interface CustomerDetailRow extends Omit<CustomerRow, "total"> {}

export async function getCustomerDetail(
  organizationId: string,
  customerId: string,
  requestedPurchasePage = 1,
  purchasePageSize = 10,
): Promise<CustomerDetail | null> {
  await ensureTransactionSeedData(organizationId);
  const pool = getPostgresPool();
  const customerResult = await pool.query<CustomerDetailRow>(
    `SELECT id, name, email, phone, company, segment, "orderCount", "lifetimeSpend",
       "lastOrderAt", "archivedAt"
     FROM (${classifiedCustomers}) customers WHERE id = $2`,
    [organizationId, customerId],
  );
  const row = customerResult.rows[0];
  if (!row) return null;

  const [purchaseCountResult, activityResult] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM dashboard_transactions
       WHERE organization_id = $1 AND customer_id = $2`,
      [organizationId, customerId],
    ),
    pool.query<CustomerActivity>(
      `SELECT id, event_type AS "eventType", description,
         related_order_id AS "relatedOrderId", created_at::text AS "occurredAt"
       FROM dashboard_customer_activity
       WHERE organization_id = $1 AND customer_id = $2
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [organizationId, customerId],
    ),
  ]);
  const purchaseTotal = Number(purchaseCountResult.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(purchaseTotal / purchasePageSize));
  const purchasePage = Math.min(Math.max(1, requestedPurchasePage), totalPages);
  const purchaseResult = await pool.query<TransactionRow>(
      `SELECT t.id, COALESCE(c.full_name, t.customer) AS customer,
         COALESCE(c.email, t.email) AS email, COALESCE(p.name, t.product) AS product,
         COALESCE(pc.name, t.category) AS category, t.region,
         t.customer_id::text AS "customerId", t.order_status AS "orderStatus",
         t.transaction_date::text AS date, t.amount::float8 AS amount, t.status
       FROM dashboard_transactions t
       LEFT JOIN dashboard_customers c
         ON c.id = t.customer_id AND c.organization_id = t.organization_id
       LEFT JOIN dashboard_products p
         ON p.id = t.product_id AND p.organization_id = t.organization_id
       LEFT JOIN dashboard_product_categories pc
         ON pc.id = p.category_id AND pc.organization_id = p.organization_id
       WHERE t.organization_id = $1 AND t.customer_id = $2
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT $3 OFFSET $4`,
      [organizationId, customerId, purchasePageSize, (purchasePage - 1) * purchasePageSize],
    );
  const purchases = purchaseResult.rows.map((purchase) => ({
    ...purchase,
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${purchase.date}T00:00:00.000Z`)),
  }));
  const activity = activityResult.rows.map((event) => ({
    ...event,
    occurredAt: new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(event.occurredAt)),
  }));

  return {
    customer: formatCustomer({ ...row, total: 0 }),
    purchases,
    purchaseTotal,
    purchasePage,
    purchasePageSize,
    activity,
  };
}
