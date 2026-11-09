import {
  orderStatuses,
  transactionSortFields,
  transactionStatuses,
  type OrderStatus,
  type TransactionStatus,
  type TransactionSortField,
} from "@/app/types/dashboard";
import type { TransactionFilters } from "@/app/lib/transaction-queries";

export function parseIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

export function parseOrderFilters(params: URLSearchParams, pageSize: number): TransactionFilters {
  const rawPage = Number(params.get("page"));
  const status = params.get("status");
  const orderStatus = params.get("orderStatus");
  const sort = params.get("sort");
  const direction = params.get("direction");
  const granularity = params.get("granularity");
  const startDate = parseIsoDate(params.get("from"));
  const endDate = parseIsoDate(params.get("to"));

  return {
    search: (params.get("q") ?? "").trim().slice(0, 100),
    status: transactionStatuses.find((value): value is TransactionStatus => value === status) ?? "",
    orderStatus: orderStatuses.find((value): value is OrderStatus => value === orderStatus) ?? "",
    sort: transactionSortFields.find((value): value is TransactionSortField => value === sort) ?? "date",
    direction: direction === "asc" ? "asc" : "desc",
    page: Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 1_000_000) : 1,
    pageSize,
    startDate: startDate && endDate && startDate <= endDate ? startDate : undefined,
    endDate: startDate && endDate && startDate <= endDate ? endDate : undefined,
    granularity: granularity === "weekly" || granularity === "monthly"
      ? granularity
      : "daily",
  };
}

export function orderFiltersSearchParams(filters: TransactionFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.orderStatus) params.set("orderStatus", filters.orderStatus);
  params.set("sort", filters.sort);
  params.set("direction", filters.direction);
  if (filters.startDate) params.set("from", filters.startDate);
  if (filters.endDate) params.set("to", filters.endDate);
  params.set("granularity", filters.granularity);
  return params;
}
