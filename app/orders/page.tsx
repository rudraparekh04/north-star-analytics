import Link from "next/link";
import DataTable from "@/app/components/DataTable";
import MainLayout from "@/app/layouts/MainLayout";
import { getOrganizationMemberships, requireOrganizationSession } from "@/app/lib/auth";
import { createOrderAction } from "@/app/lib/order-actions";
import { parseIsoDate, parseOrderFilters } from "@/app/lib/order-filter-params";
import { getOrderProductOptions } from "@/app/lib/product-queries";
import { getTransactionPage } from "@/app/lib/transaction-queries";
import { transactionStatuses } from "@/app/types/dashboard";

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function toSearchParams(search: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") params.set(key, value);
    else if (value?.length) params.set(key, value[0]);
  }
  return params;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await requireOrganizationSession();
  const [params, memberships, products] = await Promise.all([
    searchParams,
    getOrganizationMemberships(session.userId),
    getOrderProductOptions(session.organization.id),
  ]);
  const query = toSearchParams(params);
  const filters = parseOrderFilters(query, 20);
  const hasDateInput = query.has("from") || query.has("to");
  const requestedStart = parseIsoDate(query.get("from"));
  const requestedEnd = parseIsoDate(query.get("to"));
  const invalidRange = hasDateInput && (
    !requestedStart || !requestedEnd || requestedStart > requestedEnd
  );
  const page = await getTransactionPage(session.organization.id, filters);
  const editor = session.organization.role !== "viewer";

  return (
    <MainLayout session={session} memberships={memberships}>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-20 sm:px-7 sm:pt-8 lg:px-10">
        <div className="mb-6">
          <p className="mb-1.5 text-[11px] font-medium text-slate-500">
            <Link href="/" className="hover:text-indigo-700">Workspace</Link>
            <span aria-hidden="true" className="px-1">/</span>
            Orders
          </p>
          <h1 className="text-[25px] font-semibold tracking-[-0.04em] text-slate-900">Orders</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">Review order details, track fulfillment, and manage order status.</p>
        </div>
        {params.updated && (
          <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Updated order status for {params.updated} order{params.updated === "1" ? "" : "s"}.
          </p>
        )}
        {params.error && (
          <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {params.error === "stock" ? "One or more products do not have enough stock. Adjust inventory before shipping these orders." :
              params.error === "order" ? "One or more selected orders could not be found in this workspace." :
                params.error === "product" ? "Choose an active product before creating the order." :
                  params.error === "order-invalid" ? "Check the customer, date, product, payment status, and order amount." :
                    "Choose a valid order status and select up to 100 orders."}
          </p>
        )}
        {invalidRange && (
          <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The date range was invalid and has been ignored.
          </p>
        )}
        {editor && (
          <details className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Create order</summary>
            {products.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">
                Add an active product before creating an order.{" "}
                <Link href="/products" className="font-medium text-indigo-700 hover:underline">Go to products</Link>
              </p>
            ) : (
              <form action={createOrderAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Customer name
                  <input required minLength={2} maxLength={100} name="customerName" autoComplete="name" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Customer email
                  <input required type="email" maxLength={254} name="customerEmail" autoComplete="email" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Product
                  <select required name="productId" defaultValue={products[0].id} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {product.category} · {product.stockQuantity} in stock
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Order amount (USD)
                  <input required type="number" min="0" max="9999999999.99" step="0.01" name="amount" defaultValue={products[0].unitPrice.toFixed(2)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Payment status
                  <select required name="paymentStatus" defaultValue="Pending" className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                    {transactionStatuses.filter((status) => status !== "Refunded").map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Order date
                  <input required type="date" name="transactionDate" defaultValue={new Date().toISOString().slice(0, 10)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Region
                  <input maxLength={100} name="region" placeholder="Unassigned" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <div className="flex items-end">
                  <button type="submit" className="h-10 w-full rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">Create order</button>
                </div>
                <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
                  The amount starts at the first product&apos;s catalog price; update it if you choose a different product or apply a discount.
                  New orders start as Processing. One unit of inventory is deducted when marked Shipped or Delivered.
                </p>
              </form>
            )}
          </details>
        )}
        <DataTable
          page={page}
          filters={filters}
          title="All orders"
          pagePath="/orders"
          enableBulkActions
          canUpdateStatus={session.organization.role !== "viewer"}
        />
      </div>
    </MainLayout>
  );
}
