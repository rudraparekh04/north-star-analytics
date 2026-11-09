import Link from "next/link";
import { notFound } from "next/navigation";
import MainLayout from "@/app/layouts/MainLayout";
import { getOrganizationMemberships, requireOrganizationSession } from "@/app/lib/auth";
import { updateOrderStatusAction } from "@/app/lib/order-actions";
import { getOrderById } from "@/app/lib/transaction-queries";
import { orderStatuses } from "@/app/types/dashboard";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default async function OrderDetailPage({
  params,
  searchParams,
}: OrderDetailPageProps) {
  const session = await requireOrganizationSession();
  const [{ id }, query, memberships] = await Promise.all([
    params,
    searchParams,
    getOrganizationMemberships(session.userId),
  ]);
  if (id.length > 120) notFound();
  const order = await getOrderById(session.organization.id, id);
  if (!order) notFound();
  const canUpdateStatus = session.organization.role !== "viewer";

  return (
    <MainLayout session={session} memberships={memberships}>
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-20 sm:px-7 sm:pt-8 lg:px-10">
        <p className="mb-1.5 text-[11px] font-medium text-slate-500">
          <Link href="/orders" className="hover:text-indigo-700">Orders</Link>
          <span aria-hidden="true" className="px-1">/</span>
          {order.id}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[25px] font-semibold tracking-[-0.04em] text-slate-900">Order {order.id}</h1>
            <p className="mt-1.5 text-[13px] text-slate-500">Placed on {order.date}</p>
          </div>
          <Link href="/orders" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Back to orders
          </Link>
        </div>

        {query.updated && (
          <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Order status updated.
          </p>
        )}
        {query.error === "stock" && (
          <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            This product is out of stock. Adjust inventory before marking the order as shipped or delivered.
          </p>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="order-items-title" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 id="order-items-title" className="text-sm font-semibold text-slate-900">Order details</h2>
            <dl className="mt-5 divide-y divide-slate-100">
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-slate-500">Product</dt>
                <dd className="text-right font-medium text-slate-800">{order.product}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-slate-500">Category</dt>
                <dd className="text-right font-medium text-slate-800">{order.category}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-slate-500">Region</dt>
                <dd className="text-right font-medium text-slate-800">{order.region}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-slate-500">Payment status</dt>
                <dd className="font-medium text-slate-800">{order.status}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-slate-500">Order status</dt>
                <dd className="font-medium text-slate-800">{order.orderStatus}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-slate-500">Total</dt>
                <dd className="font-semibold text-slate-900">{currency.format(order.amount)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="customer-title" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 id="customer-title" className="text-sm font-semibold text-slate-900">Customer</h2>
            <p className="mt-5 text-sm font-medium text-slate-800">{order.customer}</p>
            <a href={`mailto:${order.email}`} className="mt-1 block break-all text-sm text-indigo-700 hover:underline">
              {order.email}
            </a>
          </section>
        </div>

        <section aria-labelledby="fulfillment-title" className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 id="fulfillment-title" className="text-sm font-semibold text-slate-900">Fulfillment</h2>
          {canUpdateStatus ? (
            <form action={updateOrderStatusAction} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="orderId" value={order.id} />
              <label className="grid gap-1.5 text-xs font-medium text-slate-700">
                Order status
                <select name="orderStatus" defaultValue={order.orderStatus} className="h-10 min-w-48 rounded-lg border border-slate-200 bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
                  {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <button type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                Update status
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Your viewer role does not allow order status changes.</p>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
