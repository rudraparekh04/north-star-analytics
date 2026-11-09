import { requireOrganizationSession } from "@/app/lib/auth";
import { parseOrderFilters } from "@/app/lib/order-filter-params";
import { getOrdersForExport } from "@/app/lib/transaction-queries";

function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await requireOrganizationSession();
  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams, 20);
  const orders = await getOrdersForExport(session.organization.id, filters);
  const rows = [
    ["Order ID", "Customer", "Email", "Product", "Date", "Amount", "Payment status", "Order status", "Category", "Region"],
    ...orders.map((order) => [
      order.id,
      order.customer,
      order.email,
      order.product,
      order.date,
      order.amount.toFixed(2),
      order.status,
      order.orderStatus,
      order.category,
      order.region,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
