import DashboardView from "@/app/components/DashboardView";
import MainLayout from "@/app/layouts/MainLayout";
import { getOrganizationMemberships, requireOrganizationSession } from "@/app/lib/auth";
import {
  getDashboardAnalytics,
  getTransactionPage,
  orderStatuses,
  type SalesGranularity,
  transactionSortFields,
  transactionStatuses,
  type TransactionFilters,
} from "@/app/lib/transaction-queries";

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 1_000_000) : 1;
}

function parseIsoDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const session = await requireOrganizationSession();
  const organization = session.organization;

  const params = await searchParams;
  const fromParam = firstParam(params.from);
  const toParam = firstParam(params.to);
  const requestedStartDate = parseIsoDate(fromParam);
  const requestedEndDate = parseIsoDate(toParam);
  const hasRequestedRange = fromParam !== undefined || toParam !== undefined;
  const validRange = requestedStartDate !== undefined &&
    requestedEndDate !== undefined &&
    requestedStartDate <= requestedEndDate;
  const granularityParam = firstParam(params.granularity);
  const granularity: SalesGranularity =
    granularityParam === "weekly" || granularityParam === "monthly"
      ? granularityParam
      : "daily";
  const analytics = await getDashboardAnalytics(organization.id, {
    startDate: validRange ? requestedStartDate : undefined,
    endDate: validRange ? requestedEndDate : undefined,
    granularity,
  });
  const statusParam = firstParam(params.status);
  const orderStatusParam = firstParam(params.orderStatus);
  const sortParam = firstParam(params.sort);
  const directionParam = firstParam(params.direction);
  const filters: TransactionFilters = {
    search: (firstParam(params.q) ?? "").trim().slice(0, 100),
    status: transactionStatuses.find((status) => status === statusParam) ?? "",
    orderStatus: orderStatuses.find((status) => status === orderStatusParam) ?? "",
    sort: transactionSortFields.find((field) => field === sortParam) ?? "date",
    direction: directionParam === "asc" ? "asc" : "desc",
    page: parsePage(firstParam(params.page)),
    pageSize: 5,
    startDate: analytics.startDate,
    endDate: analytics.endDate,
    granularity,
  };

  const transactionPage = await getTransactionPage(organization.id, filters);
  const memberships = await getOrganizationMemberships(session.userId);

  return (
    <MainLayout session={session} memberships={memberships}>
      <DashboardView
        role={organization.role}
        userName={session.fullName}
        analytics={analytics}
        transactionPage={transactionPage}
        filters={{ ...filters, page: transactionPage.page }}
        granularity={granularity}
        welcome={firstParam(params.welcome) === "1"}
        invalidRange={hasRequestedRange && !validRange}
      />
    </MainLayout>
  );
}
