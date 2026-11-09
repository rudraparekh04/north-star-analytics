import Link from "next/link";
import DataTable from "@/app/components/DataTable";
import MainLayout from "@/app/layouts/MainLayout";
import { getOrganizationMemberships, requireOrganizationSession } from "@/app/lib/auth";
import { parseIsoDate, parseOrderFilters } from "@/app/lib/order-filter-params";
import { getTransactionPage } from "@/app/lib/transaction-queries";

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
  const [params, memberships] = await Promise.all([
    searchParams,
    getOrganizationMemberships(session.userId),
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
            {params.error === "stock"
              ? "One or more products do not have enough stock. Adjust inventory before shipping these orders."
              : params.error === "order"
                ? "One or more selected orders could not be found in this workspace."
                : "Choose a valid order status and select up to 100 orders."}
          </p>
        )}
        {invalidRange && (
          <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The date range was invalid and has been ignored.
          </p>
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
