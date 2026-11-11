import "server-only";

import { transactions as sampleTransactions } from "@/app/lib/dashboard-data";
import { getPostgresPool } from "@/app/lib/database";
import { ensureAppSchema } from "@/app/lib/schema";
import {
  orderStatuses,
  transactionSortFields,
  transactionStatuses,
  type Metric,
  type OrderStatus,
  type RevenuePoint,
  type Transaction,
  type TransactionSortField,
  type TransactionStatus,
} from "@/app/types/dashboard";

export { orderStatuses, transactionSortFields, transactionStatuses };
export type { TransactionSortField };
export type SortDirection = "asc" | "desc";

export interface TransactionPage {
  data: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionFilters {
  search: string;
  status: TransactionStatus | "";
  orderStatus: OrderStatus | "";
  sort: TransactionSortField;
  direction: SortDirection;
  page: number;
  pageSize: number;
  startDate?: string;
  endDate?: string;
  granularity: SalesGranularity;
}

export type SalesGranularity = "daily" | "weekly" | "monthly";

export interface DashboardBreakdown {
  label: string;
  revenue: number;
  orders: number;
}

export interface DashboardAnalytics {
  startDate: string;
  endDate: string;
  metrics: Metric[];
  trend: RevenuePoint[];
  categories: DashboardBreakdown[];
  regions: DashboardBreakdown[];
  topProducts: DashboardBreakdown[];
}

export type TransactionRow = Omit<Transaction, "date"> & { date: string };

function formatTransaction(row: TransactionRow): Transaction {
  return {
    ...row,
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${row.date}T00:00:00.000Z`)),
  };
}

function buildOrderWhere(organizationId: string, filters: TransactionFilters) {
  const clauses = ["t.organization_id = $1"];
  const values: (string | number)[] = [organizationId];
  if (filters.startDate && filters.endDate) {
    values.push(filters.startDate, filters.endDate);
    clauses.push(`t.transaction_date BETWEEN $${values.length - 1}::date AND $${values.length}::date`);
  }
  if (filters.search) {
    values.push(`%${filters.search.slice(0, 100)}%`);
    const parameter = `$${values.length}`;
    clauses.push(`(t.id ILIKE ${parameter} OR t.customer ILIKE ${parameter})`);
  }
  if (filters.status) {
    values.push(filters.status);
    clauses.push(`t.status = $${values.length}`);
  }
  if (filters.orderStatus) {
    values.push(filters.orderStatus);
    clauses.push(`t.order_status = $${values.length}`);
  }
  return { whereClause: `WHERE ${clauses.join(" AND ")}`, values };
}

const orderSelect = `SELECT t.id, COALESCE(c.full_name, t.customer) AS customer,
  COALESCE(c.email, t.email) AS email, COALESCE(p.name, t.product) AS product,
  COALESCE(pc.name, t.category) AS category, t.region,
  t.customer_id::text AS "customerId",
  t.order_status AS "orderStatus", t.transaction_date::text AS date,
  t.amount::float8 AS amount, t.status
  FROM dashboard_transactions t
  LEFT JOIN dashboard_customers c
    ON c.id = t.customer_id AND c.organization_id = t.organization_id
  LEFT JOIN dashboard_products p
    ON p.id = t.product_id AND p.organization_id = t.organization_id
  LEFT JOIN dashboard_product_categories pc
    ON pc.id = p.category_id AND pc.organization_id = p.organization_id`;

let initialization: Promise<void> | undefined;

function isoDate(date: string) {
  const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(date);
  if (!match) throw new Error(`Invalid sample transaction date: ${date}`);
  const month = String(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(match[1]) + 1).padStart(2, "0");
  return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
}

async function initializeDatabase(organizationId: string) {
  const pool = getPostgresPool();
  await ensureAppSchema();
  if (!initialization) {
    initialization = (async () => {
      const northstarOrganization = await pool.query<{ id: string }>(
        "SELECT id FROM dashboard_organizations WHERE slug = 'northstar-demo'",
      );
      const seedOrganizationId = northstarOrganization.rows[0]?.id;
      if (!seedOrganizationId) throw new Error("The Northstar demo organization was not initialized.");
      for (const transaction of sampleTransactions) {
        const existingOrder = await pool.query<{ customer_id: string | null; product_id: string | null }>(
          `SELECT customer_id, product_id FROM dashboard_transactions
           WHERE organization_id = $1 AND id = $2`,
          [seedOrganizationId, transaction.id],
        );
        let customerId = existingOrder.rows[0]?.customer_id ?? null;
        if (!customerId) {
          await pool.query(
            `INSERT INTO dashboard_customers (organization_id, full_name, email)
             VALUES ($1, $2, lower($3))
             ON CONFLICT (organization_id, lower(email)) DO NOTHING`,
            [seedOrganizationId, transaction.customer, transaction.email],
          );
          const customer = await pool.query<{ id: string }>(
            `SELECT id FROM dashboard_customers
             WHERE organization_id = $1 AND lower(email) = lower($2)`,
            [seedOrganizationId, transaction.email],
          );
          customerId = customer.rows[0]?.id ?? null;
        }
        if (!customerId) throw new Error(`Could not initialize the demo customer for order ${transaction.id}.`);
        let productId = existingOrder.rows[0]?.product_id ?? null;
        if (!productId) {
          await pool.query(
            `INSERT INTO dashboard_product_categories (organization_id, name)
             VALUES ($1, $2)
             ON CONFLICT (organization_id, lower(name)) DO NOTHING`,
            [seedOrganizationId, transaction.category],
          );
          const category = await pool.query<{ id: string }>(
            `SELECT id FROM dashboard_product_categories
             WHERE organization_id = $1 AND lower(name) = lower($2)`,
            [seedOrganizationId, transaction.category],
          );
          const categoryId = category.rows[0]?.id;
          if (!categoryId) throw new Error(`Could not initialize a product category for order ${transaction.id}.`);
          await pool.query(
            `INSERT INTO dashboard_products (organization_id, category_id, name, unit_price)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (organization_id, lower(name)) DO NOTHING`,
            [seedOrganizationId, categoryId, transaction.product, transaction.amount],
          );
          const product = await pool.query<{ id: string }>(
            `SELECT id FROM dashboard_products
             WHERE organization_id = $1 AND lower(name) = lower($2)`,
            [seedOrganizationId, transaction.product],
          );
          productId = product.rows[0]?.id ?? null;
        }
        if (!productId) throw new Error(`Could not initialize the demo product for order ${transaction.id}.`);
        await pool.query(
          `INSERT INTO dashboard_transactions
            (organization_id, id, customer, email, product, transaction_date, amount, status, category, region, order_status, customer_id, product_id)
           VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (organization_id, id) DO UPDATE
             SET category = EXCLUDED.category, region = EXCLUDED.region,
                 customer_id = EXCLUDED.customer_id, product_id = EXCLUDED.product_id
             WHERE dashboard_transactions.category = 'Uncategorized'
                OR dashboard_transactions.region = 'Unassigned'
                OR dashboard_transactions.customer_id IS NULL
                OR dashboard_transactions.product_id IS NULL`,
          [
            seedOrganizationId,
            transaction.id,
            transaction.customer,
            transaction.email,
            transaction.product,
            isoDate(transaction.date),
            transaction.amount,
            transaction.status,
            transaction.category,
            transaction.region,
            transaction.orderStatus,
            customerId,
            productId,
          ],
        );
        await pool.query(
          `INSERT INTO dashboard_customer_activity
             (organization_id, customer_id, event_type, description, related_order_id, created_at)
           VALUES ($1, $2, 'order_placed', $3, $4, $5::date::timestamp AT TIME ZONE 'UTC')
           ON CONFLICT DO NOTHING`,
          [
            seedOrganizationId,
            customerId,
            `Order ${transaction.id} placed`,
            transaction.id,
            isoDate(transaction.date),
          ],
        );
      }
    })().catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
  }
  await initialization;
  return { pool, organizationId };
}

export async function ensureTransactionSeedData(organizationId: string) {
  await initializeDatabase(organizationId);
}

function addMonths(date: string, months: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function makeMetric(
  label: string,
  value: number,
  previous: number,
  format: (value: number) => string,
): Metric {
  const change = previous === 0
    ? value === 0 ? "0.0%" : "New"
    : `${((value - previous) / Math.abs(previous) * 100).toFixed(1)}%`;
  return {
    label,
    value: format(value),
    change,
    direction: value >= previous ? "up" : "down",
    comparison: "vs previous month",
  };
}

export async function getDashboardAnalytics(
  organizationId: string,
  range: { startDate?: string; endDate?: string; granularity: SalesGranularity },
): Promise<DashboardAnalytics> {
  const { pool } = await initializeDatabase(organizationId);
  const latestResult = await pool.query<{ latest: string | null }>(
    "SELECT MAX(transaction_date)::text AS latest FROM dashboard_transactions WHERE organization_id = $1",
    [organizationId],
  );
  const today = new Date().toISOString().slice(0, 10);
  const endDate = range.endDate ?? latestResult.rows[0]?.latest ?? today;
  const startDate = range.startDate ?? `${endDate.slice(0, 7)}-01`;
  const previousStartDate = addMonths(startDate, -1);
  const previousEndDate = addMonths(endDate, -1);
  const totalsQuery = `
    SELECT
      COUNT(*)::text AS orders,
      COUNT(*) FILTER (WHERE status = 'Paid')::text AS paid_orders,
      COUNT(DISTINCT lower(email)) FILTER (WHERE status = 'Paid')::text AS active_customers,
      COALESCE(SUM(CASE
        WHEN status = 'Paid' THEN amount
        WHEN status = 'Refunded' THEN -amount
        ELSE 0
      END), 0)::float8 AS revenue
    FROM dashboard_transactions
    WHERE organization_id = $1 AND transaction_date BETWEEN $2::date AND $3::date`;
  const totalsForRange = (from: string, to: string) =>
    pool.query<{
      orders: string;
      paid_orders: string;
      active_customers: string;
      revenue: number;
    }>(totalsQuery, [organizationId, from, to]);

  const bucket = {
    daily: "date_trunc('day', transaction_date)::date",
    weekly: "date_trunc('week', transaction_date)::date",
    monthly: "date_trunc('month', transaction_date)::date",
  }[range.granularity];
  const [currentResult, previousResult, trendResult, categoryResult, regionResult, productResult] =
    await Promise.all([
      totalsForRange(startDate, endDate),
      totalsForRange(previousStartDate, previousEndDate),
      pool.query<{ period: string; revenue: number }>(
        `SELECT ${bucket}::text AS period,
           COALESCE(SUM(CASE
             WHEN status = 'Paid' THEN amount
             WHEN status = 'Refunded' THEN -amount
             ELSE 0
           END), 0)::float8 AS revenue
         FROM dashboard_transactions
         WHERE organization_id = $1 AND transaction_date BETWEEN $2::date AND $3::date
         GROUP BY ${bucket} ORDER BY ${bucket}`,
        [organizationId, startDate, endDate],
      ),
      pool.query<DashboardBreakdown>(
        `SELECT COALESCE(pc.name, t.category) AS label,
           COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount WHEN status = 'Refunded' THEN -amount ELSE 0 END), 0)::float8 AS revenue,
           COUNT(*)::int AS orders
         FROM dashboard_transactions t
         LEFT JOIN dashboard_products p ON p.id = t.product_id AND p.organization_id = t.organization_id
         LEFT JOIN dashboard_product_categories pc ON pc.id = p.category_id AND pc.organization_id = p.organization_id
         WHERE t.organization_id = $1 AND t.transaction_date BETWEEN $2::date AND $3::date
         GROUP BY COALESCE(pc.name, t.category) ORDER BY revenue DESC, label LIMIT 6`,
        [organizationId, startDate, endDate],
      ),
      pool.query<DashboardBreakdown>(
        `SELECT region AS label,
           COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount WHEN status = 'Refunded' THEN -amount ELSE 0 END), 0)::float8 AS revenue,
           COUNT(*)::int AS orders
         FROM dashboard_transactions
         WHERE organization_id = $1 AND transaction_date BETWEEN $2::date AND $3::date
         GROUP BY region ORDER BY revenue DESC, label LIMIT 6`,
        [organizationId, startDate, endDate],
      ),
      pool.query<DashboardBreakdown>(
        `SELECT COALESCE(p.name, t.product) AS label,
           COALESCE(SUM(CASE WHEN status = 'Paid' THEN amount WHEN status = 'Refunded' THEN -amount ELSE 0 END), 0)::float8 AS revenue,
           COUNT(*) FILTER (WHERE status = 'Paid')::int AS orders
         FROM dashboard_transactions t
         LEFT JOIN dashboard_products p ON p.id = t.product_id AND p.organization_id = t.organization_id
         WHERE t.organization_id = $1 AND t.transaction_date BETWEEN $2::date AND $3::date
         GROUP BY COALESCE(p.name, t.product) ORDER BY orders DESC, revenue DESC, label LIMIT 5`,
        [organizationId, startDate, endDate],
      ),
    ]);

  const current = currentResult.rows[0];
  const previous = previousResult.rows[0];
  const currentRevenue = current?.revenue ?? 0;
  const previousRevenue = previous?.revenue ?? 0;
  const currentOrders = Number(current?.orders ?? 0);
  const previousOrders = Number(previous?.orders ?? 0);
  const currentCustomers = Number(current?.active_customers ?? 0);
  const previousCustomers = Number(previous?.active_customers ?? 0);
  const currentAverageOrder = currentRevenue / Math.max(1, Number(current?.paid_orders ?? 0));
  const previousAverageOrder = previousRevenue / Math.max(1, Number(previous?.paid_orders ?? 0));

  return {
    startDate,
    endDate,
    metrics: [
      makeMetric("Revenue", currentRevenue, previousRevenue, formatCurrency),
      makeMetric("Total orders", currentOrders, previousOrders, (value) => Math.round(value).toLocaleString()),
      makeMetric("Active customers", currentCustomers, previousCustomers, (value) => Math.round(value).toLocaleString()),
      makeMetric("Average order value", currentAverageOrder, previousAverageOrder, formatCurrency),
    ],
    trend: trendResult.rows.map((row) => {
      const date = new Date(`${row.period}T00:00:00.000Z`);
      const label = range.granularity === "monthly"
        ? new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date)
        : range.granularity === "weekly"
          ? `Week of ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date)}`
          : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
      return { label, revenue: row.revenue };
    }),
    categories: categoryResult.rows,
    regions: regionResult.rows,
    topProducts: productResult.rows,
  };
}

export async function getTransactionPage(
  organizationId: string,
  filters: TransactionFilters,
): Promise<TransactionPage> {
  const { pool } = await initializeDatabase(organizationId);
  const { whereClause, values } = buildOrderWhere(organizationId, filters);
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM dashboard_transactions t ${whereClause}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const sortColumn: Record<TransactionSortField, string> = {
    date: "transaction_date",
    customer: "customer",
    amount: "amount",
  };
  const limitParameter = values.length + 1;
  const offsetParameter = values.length + 2;
  const rows = await pool.query<TransactionRow>(
    `${orderSelect}
     ${whereClause}
     ORDER BY t.${sortColumn[filters.sort]} ${filters.direction === "asc" ? "ASC" : "DESC"}, t.id ASC
     LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
    [...values, filters.pageSize, (page - 1) * filters.pageSize],
  );

  return {
    data: rows.rows.map(formatTransaction),
    total,
    page,
    pageSize: filters.pageSize,
  };
}

export async function getOrderById(organizationId: string, orderId: string) {
  const { pool } = await initializeDatabase(organizationId);
  const result = await pool.query<TransactionRow>(
    `${orderSelect} WHERE t.organization_id = $1 AND t.id = $2`,
    [organizationId, orderId],
  );
  return result.rows[0] ? formatTransaction(result.rows[0]) : null;
}

export async function getOrdersForExport(
  organizationId: string,
  filters: TransactionFilters,
) {
  const { pool } = await initializeDatabase(organizationId);
  const { whereClause, values } = buildOrderWhere(organizationId, filters);
  const sortColumn: Record<TransactionSortField, string> = {
    date: "transaction_date",
    amount: "amount",
    customer: "customer",
  };
  const result = await pool.query<TransactionRow>(
    `${orderSelect} ${whereClause}
     ORDER BY t.${sortColumn[filters.sort]} ${filters.direction === "asc" ? "ASC" : "DESC"}, t.id ASC`,
    values,
  );
  return result.rows.map(formatTransaction);
}
