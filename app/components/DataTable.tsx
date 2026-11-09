"use client";

import Link from "next/link";
import { useState } from "react";
import { bulkUpdateOrderStatusAction } from "@/app/lib/order-actions";
import { orderFiltersSearchParams } from "@/app/lib/order-filter-params";
import type { Transaction } from "@/app/types/dashboard";
import { orderStatuses } from "@/app/types/dashboard";
import type {
  TransactionFilters,
  TransactionPage,
  TransactionSortField,
} from "@/app/lib/transaction-queries";

interface DataTableProps {
  page: TransactionPage;
  filters: TransactionFilters;
  title?: string;
  pagePath?: string;
  enableBulkActions?: boolean;
  canUpdateStatus?: boolean;
  showAllOrdersLink?: boolean;
}

const paymentStatusStyles: Record<Transaction["status"], string> = {
  Paid: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Pending: "bg-amber-50 text-amber-700 ring-amber-600/15",
  Refunded: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const orderStatusStyles: Record<Transaction["orderStatus"], string> = {
  Processing: "bg-blue-50 text-blue-700 ring-blue-600/15",
  Shipped: "bg-violet-50 text-violet-700 ring-violet-600/15",
  Delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  Cancelled: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const columns: { label: string; field: TransactionSortField }[] = [
  { label: "Customer", field: "customer" },
  { label: "Date", field: "date" },
  { label: "Amount", field: "amount" },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function pageHref(
  filters: TransactionFilters,
  path: string,
  page: number,
  overrides: Partial<TransactionFilters> = {},
) {
  const nextFilters = { ...filters, ...overrides, page };
  const params = orderFiltersSearchParams(nextFilters);
  params.set("page", String(page));
  return `${path}?${params.toString()}#transactions`;
}

export default function DataTable({
  page,
  filters,
  title = "Recent transactions",
  pagePath = "/",
  enableBulkActions = false,
  canUpdateStatus = false,
  showAllOrdersLink = false,
}: DataTableProps) {
  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selected = new Set(selectedIds);
  const pageIds = page.data.map((transaction) => transaction.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const exportParams = orderFiltersSearchParams(filters);
  const showActions = enableBulkActions && canUpdateStatus;

  function togglePage(checked: boolean) {
    setSelectedIds((current) => {
      const currentSet = new Set(current);
      for (const id of pageIds) {
        if (checked) {
          if (currentSet.size < 100) currentSet.add(id);
        } else {
          currentSet.delete(id);
        }
      }
      return [...currentSet];
    });
  }

  function toggleOrder(orderId: string, checked: boolean) {
    setSelectedIds((current) => {
      if (!checked) return current.filter((id) => id !== orderId);
      return current.includes(orderId) || current.length >= 100
        ? current
        : [...current, orderId];
    });
  }

  return (
    <section id="transactions" aria-labelledby="transactions-title" className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="transactions-title" className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">Search by order ID or customer, filter, and sort orders</p>
          </div>
          {showAllOrdersLink && (
            <Link href="/orders" className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 hover:underline">
              View all orders
            </Link>
          )}
          {pagePath === "/orders" && (
            <a
              href={`/orders/export?${exportParams.toString()}`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3" /></svg>
              Export CSV
            </a>
          )}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <form action={pagePath} method="get" className="flex w-full flex-wrap items-center gap-2">
            <label className="relative block min-w-48 flex-1 sm:w-56 sm:flex-none">
              <span className="sr-only">Search order ID or customer</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              <input
                type="search"
                name="q"
                defaultValue={filters.search}
                maxLength={100}
                placeholder="Order ID or customer..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <label>
              <span className="sr-only">Filter by payment status</span>
              <select name="status" defaultValue={filters.status} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                <option value="">All payment statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Refunded">Refunded</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by order status</span>
              <select name="orderStatus" defaultValue={filters.orderStatus} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                <option value="">All order statuses</option>
                {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            {filters.startDate && <input type="hidden" name="from" value={filters.startDate} />}
            {filters.endDate && <input type="hidden" name="to" value={filters.endDate} />}
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="direction" value={filters.direction} />
            <input type="hidden" name="granularity" value={filters.granularity} />
            <button type="submit" className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              Apply
            </button>
          </form>

          {showActions && (
            <form id="bulk-order-form" action={bulkUpdateOrderStatusAction} className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-slate-500">{selectedIds.length} / 100 selected</span>
              {selectedIds.map((id) => <input key={id} type="hidden" name="orderIds" value={id} />)}
              <label className="sr-only" htmlFor="bulk-order-status">Set selected order status</label>
              <select id="bulk-order-status" name="orderStatus" required defaultValue="" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700">
                <option value="" disabled>Set order status</option>
                {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <button type="submit" disabled={!selectedIds.length} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                Update selected
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              {showActions && (
                <th scope="col" className="w-12 px-4 py-3.5">
                  <input aria-label="Select all orders on this page" type="checkbox" checked={allPageSelected} onChange={(event) => togglePage(event.target.checked)} className="size-4 rounded border-slate-300 accent-indigo-600" />
                </th>
              )}
              <th scope="col" className="px-6 py-3.5">Order</th>
              {columns.map((column) => (
                <th key={column.field} scope="col" aria-sort={filters.sort === column.field ? (filters.direction === "asc" ? "ascending" : "descending") : "none"} className={`px-4 py-3.5 ${column.field === "amount" ? "text-right" : ""}`}>
                  <Link href={pageHref(filters, pagePath, 1, { sort: column.field, direction: filters.sort === column.field && filters.direction === "asc" ? "desc" : "asc" })} className="rounded-sm hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                    {column.label}{filters.sort === column.field ? (filters.direction === "asc" ? " ↑" : " ↓") : ""}
                  </Link>
                </th>
              ))}
              <th scope="col" className="px-4 py-3.5">Product</th>
              <th scope="col" className="px-4 py-3.5">Payment</th>
              <th scope="col" className="px-4 py-3.5">Order status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {page.data.map((transaction) => (
              <tr key={transaction.id} className="transition-colors hover:bg-slate-50/60">
                {showActions && (
                  <td className="px-4 py-4">
                    <input
                      aria-label={`Select order ${transaction.id}`}
                      type="checkbox"
                      checked={selected.has(transaction.id)}
                      onChange={(event) => toggleOrder(transaction.id, event.target.checked)}
                      className="size-4 rounded border-slate-300 accent-indigo-600"
                    />
                  </td>
                )}
                <th scope="row" className="whitespace-nowrap px-6 py-4 text-xs font-medium text-indigo-700">
                  <Link href={`/orders/${encodeURIComponent(transaction.id)}`} className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                    {transaction.id}
                  </Link>
                </th>
                <td className="px-4 py-4">
                  <Link href={`/orders/${encodeURIComponent(transaction.id)}`} className="whitespace-nowrap text-xs font-medium text-slate-800 hover:text-indigo-700">
                    {transaction.customer}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{transaction.date}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-xs font-semibold text-slate-700">{currency.format(transaction.amount)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{transaction.product}</td>
                <td className="px-4 py-4">
                  <span className={`inline-flex whitespace-nowrap items-center rounded-full px-2 py-1 text-[10px] font-medium ring-1 ring-inset ${paymentStatusStyles[transaction.status]}`}>
                    {transaction.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex whitespace-nowrap items-center rounded-full px-2 py-1 text-[10px] font-medium ring-1 ring-inset ${orderStatusStyles[transaction.orderStatus]}`}>
                    {transaction.orderStatus}
                  </span>
                </td>
              </tr>
            ))}
            {page.data.length === 0 && (
              <tr>
                <td colSpan={showActions ? 8 : 7} className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">No orders found</p>
                  <p className="mt-1 text-xs text-slate-500">Try different search terms or filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-3">
        <p aria-live="polite" className="text-[11px] text-slate-600">
          Showing <span className="font-medium text-slate-800">{page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1}–{Math.min(page.page * page.pageSize, page.total)}</span> of <span className="font-medium text-slate-800">{page.total}</span> orders
        </p>
        <nav aria-label="Order pages" className="flex items-center gap-2">
          <Link
            aria-disabled={page.page <= 1}
            tabIndex={page.page <= 1 ? -1 : undefined}
            href={pageHref(filters, pagePath, Math.max(1, page.page - 1))}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${page.page <= 1 ? "pointer-events-none border-slate-100 text-slate-400" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            Previous
          </Link>
          <span className="text-xs text-slate-600">Page {page.page} of {totalPages}</span>
          <Link
            aria-disabled={page.page >= totalPages}
            tabIndex={page.page >= totalPages ? -1 : undefined}
            href={pageHref(filters, pagePath, Math.min(totalPages, page.page + 1))}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${page.page >= totalPages ? "pointer-events-none border-slate-100 text-slate-400" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            Next
          </Link>
        </nav>
      </div>
    </section>
  );
}
