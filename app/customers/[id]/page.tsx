import Link from "next/link";
import { notFound } from "next/navigation";
import MainLayout from "@/app/layouts/MainLayout";
import { archiveCustomerAction, restoreCustomerAction, updateCustomerAction } from "@/app/lib/customer-actions";
import { getCustomerDetail } from "@/app/lib/customer-queries";
import { getOrganizationMemberships, requireOrganizationSession } from "@/app/lib/auth";

interface CustomerProfilePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string; ordersPage?: string }>;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default async function CustomerProfilePage({
  params,
  searchParams,
}: CustomerProfilePageProps) {
  const session = await requireOrganizationSession();
  const [{ id }, query, memberships] = await Promise.all([
    params,
    searchParams,
    getOrganizationMemberships(session.userId),
  ]);
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) notFound();
  const parsedPurchasePage = Number(query.ordersPage);
  const requestedPurchasePage = Number.isSafeInteger(parsedPurchasePage) && parsedPurchasePage > 0
    ? Math.min(parsedPurchasePage, 1_000_000)
    : 1;
  const detail = await getCustomerDetail(session.organization.id, id, requestedPurchasePage);
  if (!detail) notFound();
  const { customer, purchases, purchaseTotal, purchasePage, purchasePageSize, activity } = detail;
  const editor = session.organization.role !== "viewer";
  const purchaseTotalPages = Math.max(1, Math.ceil(purchaseTotal / purchasePageSize));

  return (
    <MainLayout session={session} memberships={memberships}>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-20 sm:px-7 sm:pt-8 lg:px-10">
        <p className="mb-1.5 text-[11px] font-medium text-slate-500">
          <Link href="/customers" className="hover:text-indigo-700">Customers</Link>
          <span aria-hidden="true" className="px-1">/</span>
          {customer.name}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[25px] font-semibold tracking-[-0.04em] text-slate-900">{customer.name}</h1>
            <p className="mt-1.5 text-[13px] text-slate-500">
              {customer.email}
              {customer.company ? ` · ${customer.company}` : ""}
              {customer.phone ? ` · ${customer.phone}` : ""}
            </p>
          </div>
          <Link href="/customers" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Back to customers</Link>
        </div>

        {customer.archivedAt && (
          <p role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This customer is archived. Their purchase history remains available.
          </p>
        )}
        {query.updated && (
          <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Customer profile updated.</p>
        )}
        {query.error && (
          <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {query.error === "duplicate"
              ? "Another customer in this workspace already uses this email."
              : "Enter a valid name, email, phone, and company."}
          </p>
        )}

        <section aria-label="Customer lifetime metrics" className="mt-6 grid gap-4 sm:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Lifetime spending</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{currency.format(customer.lifetimeSpend)}</p>
            <p className="mt-1 text-[11px] text-slate-500">Net of refunds</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Orders</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{customer.orderCount.toLocaleString()}</p>
            <p className="mt-1 text-[11px] text-slate-500">All payment statuses</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">Segment</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{customer.segment}</p>
            <p className="mt-1 text-[11px] text-slate-500">Based on paid orders and lifetime spend</p>
          </article>
        </section>

        {editor && (
          <section aria-labelledby="customer-edit-title" className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="customer-edit-title" className="text-sm font-semibold text-slate-900">Customer profile</h2>
                <p className="mt-1 text-xs text-slate-500">Updates are reflected in order history. Archiving hides the profile but keeps its orders.</p>
              </div>
              {customer.archivedAt ? (
                <form action={restoreCustomerAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <button type="submit" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Restore customer</button>
                </form>
              ) : (
                <form action={archiveCustomerAction}>
                  <input type="hidden" name="customerId" value={customer.id} />
                  <button type="submit" className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50">Archive customer</button>
                </form>
              )}
            </div>
            {!customer.archivedAt && (
              <form action={updateCustomerAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="customerId" value={customer.id} />
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Name
                  <input required minLength={2} maxLength={100} name="name" defaultValue={customer.name} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Email
                  <input required type="email" maxLength={254} name="email" defaultValue={customer.email} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Phone
                  <input maxLength={40} name="phone" defaultValue={customer.phone} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Company
                  <input maxLength={120} name="company" defaultValue={customer.company} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
                </label>
                <button type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 sm:col-span-2 lg:col-span-4">Save changes</button>
              </form>
            )}
          </section>
        )}

        <section aria-labelledby="customer-activity-title" className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 id="customer-activity-title" className="text-sm font-semibold text-slate-900">Activity timeline</h2>
          <p className="mt-1 text-xs text-slate-500">Profile changes, purchases, and fulfillment updates</p>
          {activity.length ? (
            <ol className="mt-5 space-y-4">
              {activity.map((event) => (
                <li key={event.id} className="relative flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">
                      {event.relatedOrderId ? (
                        <Link href={`/orders/${encodeURIComponent(event.relatedOrderId)}`} className="font-medium text-indigo-700 hover:underline">{event.description}</Link>
                      ) : event.description}
                    </p>
                    <time className="mt-1 block text-[11px] text-slate-500">{event.occurredAt} UTC</time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-sm text-slate-500">No activity recorded yet.</p>
          )}
        </section>

        <section id="purchase-history" aria-labelledby="purchase-history-title" className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2 id="purchase-history-title" className="text-sm font-semibold text-slate-900">Purchase history</h2>
            <p className="mt-1 text-xs text-slate-500">Orders associated with this customer</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th scope="col" className="px-5 py-3">Order</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Product</th>
                  <th scope="col" className="px-4 py-3">Payment</th>
                  <th scope="col" className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-slate-50/70">
                    <th scope="row" className="px-5 py-3.5 text-xs font-medium text-indigo-700">
                      <Link href={`/orders/${encodeURIComponent(purchase.id)}`} className="hover:underline">{purchase.id}</Link>
                    </th>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{purchase.date}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-700">{purchase.product}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{purchase.status}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-semibold text-slate-800">{currency.format(purchase.amount)}</td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">No purchases yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">Showing {purchaseTotal === 0 ? 0 : (purchasePage - 1) * purchasePageSize + 1}–{Math.min(purchasePage * purchasePageSize, purchaseTotal)} of {purchaseTotal} orders</p>
            <nav aria-label="Purchase history pages" className="flex items-center gap-2">
              <Link aria-disabled={purchasePage <= 1} href={`/customers/${customer.id}?ordersPage=${Math.max(1, purchasePage - 1)}#purchase-history`} className={`rounded-md border px-3 py-1.5 text-xs ${purchasePage <= 1 ? "pointer-events-none border-slate-100 text-slate-400" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Previous</Link>
              <span className="text-xs text-slate-600">Page {purchasePage} of {purchaseTotalPages}</span>
              <Link aria-disabled={purchasePage >= purchaseTotalPages} href={`/customers/${customer.id}?ordersPage=${Math.min(purchaseTotalPages, purchasePage + 1)}#purchase-history`} className={`rounded-md border px-3 py-1.5 text-xs ${purchasePage >= purchaseTotalPages ? "pointer-events-none border-slate-100 text-slate-400" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Next</Link>
            </nav>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
