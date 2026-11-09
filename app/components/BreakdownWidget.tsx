import type { DashboardBreakdown } from "@/app/lib/transaction-queries";

interface BreakdownWidgetProps {
  id: string;
  title: string;
  description: string;
  items: DashboardBreakdown[];
  emptyMessage: string;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function BreakdownWidget({
  id,
  title,
  description,
  items,
  emptyMessage,
}: BreakdownWidgetProps) {
  const maximum = Math.max(...items.map((item) => item.revenue), 0);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:p-6"
    >
      <h2 id={`${id}-title`} className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
      {items.length > 0 ? (
        <ul className="mt-5 space-y-4">
          {items.map((item) => (
            <li key={item.label}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-medium text-slate-700">{item.label}</span>
                <span className="shrink-0 font-semibold text-slate-800">{currency.format(item.revenue)}</span>
              </div>
              <div
                role="meter"
                aria-label={`${item.label} revenue`}
                aria-valuemin={0}
                aria-valuemax={maximum}
                aria-valuenow={Math.max(0, item.revenue)}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${maximum > 0 ? Math.max(0, item.revenue / maximum * 100) : 0}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{item.orders.toLocaleString()} {id === "top-products" ? "paid orders" : "orders"}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-lg bg-slate-50 px-3 py-5 text-center text-xs text-slate-500">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
