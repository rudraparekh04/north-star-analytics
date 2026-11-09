import Link from "next/link";
import MainLayout from "@/app/layouts/MainLayout";
import { getOrganizationMemberships, requireOrganizationSession } from "@/app/lib/auth";
import { createCustomerAction } from "@/app/lib/customer-actions";
import { getCustomerDirectory } from "@/app/lib/customer-queries";
import type { CustomerSegment } from "@/app/types/dashboard";

interface CustomersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const segments: CustomerSegment[] = ["New", "Repeat", "High value"];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSegment(value: string | undefined): value is CustomerSegment {
  return segments.some((segment) => segment === value);
}

function pageHref(search: string, segment: CustomerSegment | "", archived: boolean, page: number) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (segment) params.set("segment", segment);
  if (archived) params.set("archived", "1");
  params.set("page", String(page));
  return `/customers?${params.toString()}`;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const session = await requireOrganizationSession();
  const [params, memberships] = await Promise.all([
    searchParams,
    getOrganizationMemberships(session.userId),
  ]);
  const search = (firstParam(params.q) ?? "").trim().slice(0, 100);
  const segmentParam = firstParam(params.segment);
  const segment = isSegment(segmentParam) ? segmentParam : "";
  const includeArchived = firstParam(params.archived) === "1";
  const parsedPage = Number(firstParam(params.page));
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 1_000_000) : 1;
  const directory = await getCustomerDirectory(session.organization.id, {
    search,
    segment,
    includeArchived,
    page: requestedPage,
    pageSize: 20,
  });
  const editor = session.organization.role !== "viewer";
  const totalPages = Math.max(1, Math.ceil(directory.total / directory.pageSize));

  return (
    <MainLayout session={session} memberships={memberships}>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-20 sm:px-7 sm:pt-8 lg:px-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-500">
              <Link href="/" className="hover:text-indigo-700">Workspace</Link>
              <span aria-hidden="true" className="px-1">/</span>
              Customers
            </p>
            <h1 className="text-[25px] font-semibold tracking-[-0.04em] text-slate-900">Customers</h1>
            <p className="mt-1.5 text-[13px] text-slate-500">Understand relationships, purchase history, and customer value.</p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Repeat customer rate</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{directory.repeatCustomerPercentage.toFixed(1)}%</p>
            <p className="text-[10px] text-slate-600">Customers with 2+ paid orders</p>
          </div>
        </header>

        {params.updated && (
          <p role="status" className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Customer profile {params.updated === "archived" ? "archived; order history retained." : "saved."}
          </p>
        )}
        {params.error && (
          <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {params.error === "duplicate"
              ? "A customer with this email already exists in this workspace."
              : params.error === "customer"
                ? "That customer could not be found or has already been archived."
                : "Enter a valid name, email, phone, and company."}
          </p>
        )}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <form action="/customers" method="get" className="flex flex-wrap items-center gap-2">
            <label>
              <span className="sr-only">Search customers</span>
              <input type="search" name="q" defaultValue={search} maxLength={100} placeholder="Search name, email, company..." className="h-10 w-64 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </label>
            <label>
              <span className="sr-only">Filter by customer segment</span>
              <select name="segment" defaultValue={segment} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                <option value="">All segments</option>
                {segments.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <input type="hidden" name="archived" value={includeArchived ? "1" : ""} />
            <button type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">Apply</button>
            <Link href={`/customers?archived=${includeArchived ? "" : "1"}`} className="px-2 text-xs font-medium text-indigo-700 hover:underline">
              {includeArchived ? "Hide archived" : "Show archived"}
            </Link>
          </form>
        </div>

        {editor && (
          <details className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">Add customer</summary>
            <form action={createCustomerAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Name
                <input required minLength={2} maxLength={100} name="name" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Email
                <input required type="email" maxLength={254} name="email" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Phone
                <input maxLength={40} name="phone" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Company
                <input maxLength={120} name="company" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <button type="submit" className="mt-auto h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">Save customer</button>
            </form>
          </details>
        )}

        <section aria-label="Customer directory" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th scope="col" className="px-5 py-3.5">Customer</th>
                  <th scope="col" className="px-4 py-3.5">Segment</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Orders</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Lifetime spend</th>
                  <th scope="col" className="px-4 py-3.5">Last purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {directory.customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/70">
                    <th scope="row" className="px-5 py-4">
                      <Link href={`/customers/${customer.id}`} className="text-sm font-semibold text-indigo-700 hover:underline">{customer.name}</Link>
                      <p className="mt-0.5 text-xs font-normal text-slate-500">{customer.email}{customer.company ? ` · ${customer.company}` : ""}</p>
                      {customer.archivedAt && <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">Archived</span>}
                    </th>
                    <td className="px-4 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-medium text-indigo-700">{customer.segment}</span></td>
                    <td className="px-4 py-4 text-right text-sm text-slate-700">{customer.orderCount.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-slate-800">{currency.format(customer.lifetimeSpend)}</td>
                    <td className="px-4 py-4 text-xs text-slate-500">{customer.lastOrderAt ?? "No purchases yet"}</td>
                  </tr>
                ))}
                {directory.customers.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">No customers match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">Showing {directory.total === 0 ? 0 : (directory.page - 1) * directory.pageSize + 1}–{Math.min(directory.page * directory.pageSize, directory.total)} of {directory.total} customers</p>
            <nav aria-label="Customer pages" className="flex items-center gap-2">
              <Link aria-disabled={directory.page <= 1} href={pageHref(search, segment, includeArchived, Math.max(1, directory.page - 1))} className={`rounded-md border px-3 py-1.5 text-xs ${directory.page <= 1 ? "pointer-events-none border-slate-100 text-slate-400" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Previous</Link>
              <span className="text-xs text-slate-600">Page {directory.page} of {totalPages}</span>
              <Link aria-disabled={directory.page >= totalPages} href={pageHref(search, segment, includeArchived, Math.min(totalPages, directory.page + 1))} className={`rounded-md border px-3 py-1.5 text-xs ${directory.page >= totalPages ? "pointer-events-none border-slate-100 text-slate-400" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Next</Link>
            </nav>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
