import "server-only";

import { getPostgresPool } from "@/app/lib/database";
import { ensureTransactionSeedData } from "@/app/lib/transaction-queries";

export interface ProductCategory {
  id: string;
  name: string;
}

export interface ProductRecord {
  id: string;
  categoryId: string;
  category: string;
  name: string;
  sku: string;
  description: string;
  unitPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  hasImage: boolean;
  archivedAt: string | null;
  soldOrders: number;
  revenue: number;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  quantityDelta: number;
  movementType: string;
  reason: string;
  relatedOrderId: string | null;
  occurredAt: string;
}

export async function getProductCatalog(organizationId: string) {
  await ensureTransactionSeedData(organizationId);
  const pool = getPostgresPool();
  const [products, categories, movements] = await Promise.all([
    pool.query<ProductRecord>(
      `SELECT p.id, p.category_id AS "categoryId", c.name AS category,
         p.name, p.sku, p.description, p.unit_price::float8 AS "unitPrice",
         p.stock_quantity AS "stockQuantity", p.low_stock_threshold AS "lowStockThreshold",
         (p.image_data IS NOT NULL) AS "hasImage",
         p.archived_at::text AS "archivedAt",
         COUNT(t.id) FILTER (WHERE t.status = 'Paid')::int AS "soldOrders",
         COALESCE(SUM(CASE
           WHEN t.status = 'Paid' THEN t.amount
           WHEN t.status = 'Refunded' THEN -t.amount
           ELSE 0
         END), 0)::float8 AS revenue
       FROM dashboard_products p
       JOIN dashboard_product_categories c
         ON c.id = p.category_id AND c.organization_id = p.organization_id
       LEFT JOIN dashboard_transactions t
         ON t.product_id = p.id AND t.organization_id = p.organization_id
       WHERE p.organization_id = $1
       GROUP BY p.id, c.name
       ORDER BY p.name`,
      [organizationId],
    ),
    pool.query<ProductCategory>(
      `SELECT id, name FROM dashboard_product_categories
       WHERE organization_id = $1 AND archived_at IS NULL
       ORDER BY name`,
      [organizationId],
    ),
    pool.query<InventoryMovement>(
      `SELECT m.id, m.product_id AS "productId", p.name AS "productName",
         m.quantity_delta AS "quantityDelta", m.movement_type AS "movementType",
         m.reason, m.related_order_id AS "relatedOrderId",
         m.created_at::text AS "occurredAt"
       FROM dashboard_inventory_movements m
       JOIN dashboard_products p
         ON p.id = m.product_id AND p.organization_id = m.organization_id
       WHERE m.organization_id = $1
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 50`,
      [organizationId],
    ),
  ]);
  return {
    products: products.rows,
    categories: categories.rows,
    movements: movements.rows,
  };
}
