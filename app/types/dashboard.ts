export type TransactionStatus = "Paid" | "Pending" | "Refunded";
export const transactionStatuses = ["Paid", "Pending", "Refunded"] as const satisfies readonly TransactionStatus[];
export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled";
export const orderStatuses = ["Processing", "Shipped", "Delivered", "Cancelled"] as const satisfies readonly OrderStatus[];
export const transactionSortFields = ["date", "amount", "customer"] as const;
export type TransactionSortField = (typeof transactionSortFields)[number];
export type UserRole = "admin" | "analyst" | "viewer";

export interface Metric {
  label: string;
  value: string;
  change: string;
  direction: "up" | "down";
  comparison: string;
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  expenses?: number;
}

export interface Transaction {
  id: string;
  customer: string;
  email: string;
  product: string;
  date: string;
  amount: number;
  status: TransactionStatus;
  orderStatus: OrderStatus;
  category: string;
  region: string;
  customerId?: string | null;
}

export type CustomerSegment = "New" | "Repeat" | "High value";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  segment: CustomerSegment;
  orderCount: number;
  lifetimeSpend: number;
  lastOrderAt: string | null;
  archivedAt: string | null;
}

export interface CustomerActivity {
  id: string;
  eventType: string;
  description: string;
  relatedOrderId: string | null;
  occurredAt: string;
}

export interface TrafficSource {
  label: string;
  value: number;
  color: string;
}
