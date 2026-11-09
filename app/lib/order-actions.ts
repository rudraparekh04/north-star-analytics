"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { requireOrganizationSession } from "@/app/lib/auth";
import { getPostgresPool } from "@/app/lib/database";
import { orderStatuses, type OrderStatus } from "@/app/types/dashboard";

function isOrderStatus(value: FormDataEntryValue | null): value is OrderStatus {
  return typeof value === "string" && orderStatuses.some((status) => status === value);
}

async function requireOrderEditor() {
  const session = await requireOrganizationSession();
  if (session.organization.role === "viewer") redirect("/forbidden");
  return session;
}

function revalidateOrderViews(orderIds: string[], customerIds: (string | null)[]) {
  revalidatePath("/", "page");
  revalidatePath("/orders", "page");
  revalidatePath("/customers", "page");
  revalidatePath("/products", "page");
  for (const orderId of orderIds) {
    revalidatePath(`/orders/${encodeURIComponent(orderId)}`, "page");
  }
  for (const customerId of new Set(customerIds.filter((id): id is string => id !== null))) {
    revalidatePath(`/customers/${customerId}`, "page");
  }
}

interface LockedOrder {
  id: string;
  customer_id: string | null;
  product_id: string | null;
  order_status: OrderStatus;
  inventory_deducted: boolean;
}

type StatusUpdateResult = "ok" | "stock";

async function applyOrderStatus(
  client: PoolClient,
  organizationId: string,
  order: LockedOrder,
  status: OrderStatus,
): Promise<StatusUpdateResult> {
  const willBeAllocated = status === "Shipped" || status === "Delivered";
  if (order.order_status === status && order.inventory_deducted === willBeAllocated) return "ok";
  const shouldDeduct = willBeAllocated && !order.inventory_deducted;
  const shouldRestore = !willBeAllocated && order.inventory_deducted;
  if (shouldDeduct || shouldRestore) {
    if (!order.product_id) return "stock";
    if (shouldDeduct) {
      const product = await client.query<{ stock_quantity: number }>(
        `SELECT stock_quantity FROM dashboard_products
         WHERE organization_id = $1 AND id = $2
         FOR UPDATE`,
        [organizationId, order.product_id],
      );
      if (!product.rows[0] || product.rows[0].stock_quantity < 1) return "stock";
      await client.query(
        `UPDATE dashboard_products
         SET stock_quantity = stock_quantity - 1, updated_at = now()
         WHERE organization_id = $1 AND id = $2`,
        [organizationId, order.product_id],
      );
      await client.query(
        `INSERT INTO dashboard_inventory_movements
           (organization_id, product_id, quantity_delta, movement_type, reason, related_order_id)
         VALUES ($1, $2, -1, 'order_shipped', $3, $4)`,
        [organizationId, order.product_id, `Stock deducted when order moved to ${status}`, order.id],
      );
    } else {
      const restored = await client.query<{ id: string }>(
        `UPDATE dashboard_products
         SET stock_quantity = stock_quantity + 1, updated_at = now()
         WHERE organization_id = $1 AND id = $2 AND stock_quantity < 2147483647
         RETURNING id`,
        [organizationId, order.product_id],
      );
      if (restored.rowCount !== 1) return "stock";
      await client.query(
        `INSERT INTO dashboard_inventory_movements
           (organization_id, product_id, quantity_delta, movement_type, reason, related_order_id)
         VALUES ($1, $2, 1, $3, $4, $5)`,
        [
          organizationId,
          order.product_id,
          status === "Cancelled" ? "order_cancelled" : "order_restocked",
          status === "Cancelled" ? "Stock restored after order cancellation" : "Stock restored after fulfillment reversal",
          order.id,
        ],
      );
    }
  }

  await client.query(
    `UPDATE dashboard_transactions SET order_status = $3, inventory_deducted = $4
     WHERE organization_id = $1 AND id = $2`,
    [organizationId, order.id, status, willBeAllocated],
  );
  if (order.customer_id) {
    await client.query(
      `INSERT INTO dashboard_customer_activity
         (organization_id, customer_id, event_type, description, related_order_id)
       VALUES ($1, $2, 'order_status_changed', $3, $4)`,
      [organizationId, order.customer_id, `Order ${order.id} status changed to ${status}`, order.id],
    );
  }
  return "ok";
}

export async function updateOrderStatusAction(formData: FormData) {
  const session = await requireOrderEditor();
  const orderId = formData.get("orderId");
  const status = formData.get("orderStatus");
  if (typeof orderId !== "string" || orderId.length < 1 || orderId.length > 120 || !isOrderStatus(status)) {
    redirect("/orders?error=invalid");
  }

  const client = await getPostgresPool().connect();
  let failure: "order" | "stock" | undefined;
  let customerId: string | null = null;
  try {
    await client.query("BEGIN");
    const result = await client.query<LockedOrder>(
      `SELECT id, customer_id, product_id, order_status, inventory_deducted
       FROM dashboard_transactions
       WHERE organization_id = $1 AND id = $2
       FOR UPDATE`,
      [session.organization.id, orderId],
    );
    const order = result.rows[0];
    if (!order) {
      failure = "order";
    } else {
      customerId = order.customer_id;
      failure = await applyOrderStatus(client, session.organization.id, order, status) === "stock"
        ? "stock"
        : undefined;
    }
    if (failure) await client.query("ROLLBACK");
    else await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (failure === "stock") redirect(`/orders/${encodeURIComponent(orderId)}?error=stock`);
  if (failure) redirect("/orders?error=order");
  revalidateOrderViews([orderId], [customerId]);
  redirect(`/orders/${encodeURIComponent(orderId)}?updated=1`);
}

export async function bulkUpdateOrderStatusAction(formData: FormData) {
  const session = await requireOrderEditor();
  const status = formData.get("orderStatus");
  const orderIds = [...new Set(formData.getAll("orderIds").filter(
    (value): value is string => typeof value === "string" && value.length > 0 && value.length <= 120,
  ))];
  if (!isOrderStatus(status) || orderIds.length === 0 || orderIds.length > 100) {
    redirect("/orders?error=invalid");
  }

  const client = await getPostgresPool().connect();
  let failure: "order" | "stock" | undefined;
  let customerIds: (string | null)[] = [];
  try {
    await client.query("BEGIN");
    const result = await client.query<LockedOrder>(
      `SELECT id, customer_id, product_id, order_status, inventory_deducted
       FROM dashboard_transactions
       WHERE organization_id = $1 AND id = ANY($2::text[])
       ORDER BY id
       FOR UPDATE`,
      [session.organization.id, orderIds],
    );
    if (result.rows.length !== orderIds.length) {
      failure = "order";
    } else {
      customerIds = result.rows.map((order) => order.customer_id);
      for (const order of result.rows) {
        const updateResult = await applyOrderStatus(client, session.organization.id, order, status);
        if (updateResult === "stock") {
          failure = "stock";
          break;
        }
      }
    }
    if (failure) await client.query("ROLLBACK");
    else await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (failure === "stock") redirect("/orders?error=stock");
  if (failure) redirect("/orders?error=order");
  revalidateOrderViews(orderIds, customerIds);
  redirect(`/orders?updated=${orderIds.length}`);
}
