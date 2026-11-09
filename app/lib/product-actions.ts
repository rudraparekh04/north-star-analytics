"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganizationSession } from "@/app/lib/auth";
import { getPostgresPool } from "@/app/lib/database";

const uuidPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;

async function requireProductEditor() {
  const session = await requireOrganizationSession();
  if (session.organization.role === "viewer") redirect("/forbidden");
  return session;
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : null;
}

function revalidateProducts() {
  revalidatePath("/products", "page");
  revalidatePath("/", "page");
  revalidatePath("/orders", "page");
  revalidatePath("/orders/[id]", "page");
  revalidatePath("/customers/[id]", "page");
}

function readProduct(formData: FormData) {
  const name = field(formData, "name");
  const categoryId = field(formData, "categoryId");
  const sku = field(formData, "sku");
  const description = field(formData, "description");
  const priceValue = field(formData, "unitPrice");
  const stockValue = field(formData, "stockQuantity");
  const thresholdValue = field(formData, "lowStockThreshold");
  if (
    name === null || categoryId === null || sku === null || description === null ||
    priceValue === null || stockValue === null || thresholdValue === null ||
    name.length < 2 || name.length > 120 || !uuidPattern.test(categoryId) ||
    sku.length > 64 || description.length > 1000 ||
    !/^\d+(?:\.\d{1,2})?$/.test(priceValue) ||
    !/^\d{1,9}$/.test(stockValue) || !/^\d{1,9}$/.test(thresholdValue)
  ) return null;
  const unitPrice = Number(priceValue);
  const stockQuantity = Number(stockValue);
  const lowStockThreshold = Number(thresholdValue);
  if (!Number.isFinite(unitPrice) || unitPrice > 9_999_999_999.99) return null;
  return { name, categoryId, sku, description, unitPrice, stockQuantity, lowStockThreshold };
}

export async function createProductAction(formData: FormData) {
  const session = await requireProductEditor();
  const product = readProduct(formData);
  if (!product) redirect("/products?error=invalid");
  const result = await getPostgresPool().query<{ id: string }>(
    `WITH saved AS (
       INSERT INTO dashboard_products
         (organization_id, category_id, name, sku, description, unit_price,
          stock_quantity, low_stock_threshold)
       SELECT $1, c.id, $3, $4, $5, $6, $7, $8
       FROM dashboard_product_categories c
       WHERE c.organization_id = $1 AND c.id = $2 AND c.archived_at IS NULL
       ON CONFLICT DO NOTHING
       RETURNING id, stock_quantity
     ),
     movement AS (
       INSERT INTO dashboard_inventory_movements
         (organization_id, product_id, quantity_delta, movement_type, reason)
       SELECT $1, id, stock_quantity, 'initial_stock', 'Initial stock on product creation'
       FROM saved WHERE stock_quantity > 0
       RETURNING id
     )
     SELECT id FROM saved`,
    [
      session.organization.id,
      product.categoryId,
      product.name,
      product.sku,
      product.description,
      product.unitPrice,
      product.stockQuantity,
      product.lowStockThreshold,
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) redirect("/products?error=duplicate");
  revalidateProducts();
  redirect("/products?updated=created");
}

export async function updateProductAction(formData: FormData) {
  const session = await requireProductEditor();
  const id = field(formData, "productId");
  const product = readProduct(formData);
  if (!id || !uuidPattern.test(id)) redirect("/products?error=invalid");
  if (!product) redirect("/products?error=invalid");
  const result = await getPostgresPool().query<{ id: string }>(
    `UPDATE dashboard_products p
     SET category_id = c.id, name = $3, sku = $4, description = $5,
         unit_price = $6, low_stock_threshold = $7, updated_at = now()
     FROM dashboard_product_categories c
     WHERE p.organization_id = $1 AND p.id = $2 AND p.archived_at IS NULL
       AND c.organization_id = p.organization_id AND c.id = $8 AND c.archived_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM dashboard_products other
         WHERE other.organization_id = p.organization_id AND other.id <> p.id
           AND (lower(other.name) = lower($3)
             OR ($4 <> '' AND lower(other.sku) = lower($4)))
       )
     RETURNING p.id`,
    [
      session.organization.id,
      id,
      product.name,
      product.sku,
      product.description,
      product.unitPrice,
      product.lowStockThreshold,
      product.categoryId,
    ],
  );
  if (result.rowCount !== 1) redirect("/products?error=duplicate");
  revalidateProducts();
  redirect("/products?updated=saved");
}

export async function adjustInventoryAction(formData: FormData) {
  const session = await requireProductEditor();
  const productId = field(formData, "productId");
  const deltaValue = field(formData, "quantityDelta");
  const reason = field(formData, "reason");
  if (
    !productId || !uuidPattern.test(productId) || !deltaValue ||
    !/^-?\d{1,9}$/.test(deltaValue) || !reason || reason.length > 200
  ) redirect("/products?error=invalid");
  const delta = Number(deltaValue);
  if (!Number.isSafeInteger(delta) || delta === 0) redirect("/products?error=invalid");
  const result = await getPostgresPool().query<{ id: string }>(
    `WITH changed AS (
       UPDATE dashboard_products
       SET stock_quantity = stock_quantity + $3, updated_at = now()
       WHERE organization_id = $1 AND id = $2 AND archived_at IS NULL
         AND stock_quantity + $3 BETWEEN 0 AND 2147483647
       RETURNING id
     ),
     movement AS (
       INSERT INTO dashboard_inventory_movements
         (organization_id, product_id, quantity_delta, movement_type, reason)
       SELECT $1, id, $3, 'adjustment', $4 FROM changed
       RETURNING id
     )
     SELECT id FROM changed`,
    [session.organization.id, productId, delta, reason],
  );
  if (result.rowCount !== 1) redirect("/products?error=stock");
  revalidateProducts();
  redirect("/products?updated=stock");
}

export async function archiveProductAction(formData: FormData) {
  const session = await requireProductEditor();
  const id = field(formData, "productId");
  if (!id || !uuidPattern.test(id)) redirect("/products?error=invalid");
  const result = await getPostgresPool().query(
    `UPDATE dashboard_products SET archived_at = now(), updated_at = now()
     WHERE organization_id = $1 AND id = $2 AND archived_at IS NULL`,
    [session.organization.id, id],
  );
  if (result.rowCount !== 1) redirect("/products?error=product");
  revalidateProducts();
  redirect("/products?updated=archived");
}

export async function restoreProductAction(formData: FormData) {
  const session = await requireProductEditor();
  const id = field(formData, "productId");
  if (!id || !uuidPattern.test(id)) redirect("/products?error=invalid");
  const result = await getPostgresPool().query(
    `UPDATE dashboard_products SET archived_at = NULL, updated_at = now()
     WHERE organization_id = $1 AND id = $2 AND archived_at IS NOT NULL`,
    [session.organization.id, id],
  );
  if (result.rowCount !== 1) redirect("/products?error=product");
  revalidateProducts();
  redirect("/products?updated=restored");
}

export async function createProductCategoryAction(formData: FormData) {
  const session = await requireProductEditor();
  const name = field(formData, "name");
  if (!name || name.length > 80) redirect("/products?error=invalid");
  const result = await getPostgresPool().query<{ id: string }>(
    `INSERT INTO dashboard_product_categories (organization_id, name)
     VALUES ($1, $2)
     ON CONFLICT (organization_id, lower(name)) DO NOTHING
     RETURNING id`,
    [session.organization.id, name],
  );
  if (result.rowCount !== 1) redirect("/products?error=category");
  revalidateProducts();
  redirect("/products?updated=category");
}

export async function updateProductCategoryAction(formData: FormData) {
  const session = await requireProductEditor();
  const id = field(formData, "categoryId");
  const name = field(formData, "name");
  if (!id || !uuidPattern.test(id) || !name || name.length > 80) redirect("/products?error=invalid");
  const result = await getPostgresPool().query<{ id: string }>(
    `UPDATE dashboard_product_categories c
     SET name = $3
     WHERE c.organization_id = $1 AND c.id = $2 AND c.archived_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM dashboard_product_categories other
         WHERE other.organization_id = c.organization_id AND other.id <> c.id
           AND lower(other.name) = lower($3)
       )
     RETURNING c.id`,
    [session.organization.id, id, name],
  );
  if (result.rowCount !== 1) redirect("/products?error=category");
  revalidateProducts();
  redirect("/products?updated=category");
}
