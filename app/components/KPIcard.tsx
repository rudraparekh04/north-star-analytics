import type { Metric } from "@/app/types/dashboard";

interface KPICardProps {
  metric: Metric;
  icon: "revenue" | "users" | "conversion" | "orders";
}

const iconPaths = {
  revenue: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  conversion: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  orders: <><path d="M6 7h12l1 14H5L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></>,
};

const iconColors = {
  revenue: "bg-indigo-50 text-indigo-600",
  users: "bg-emerald-50 text-emerald-600",
  conversion: "bg-amber-50 text-amber-600",
  orders: "bg-rose-50 text-rose-600",
};

export default function KPICard({ metric, icon }: KPICardProps) {
  const isPositive = metric.direction === "up";

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-slate-500">{metric.label}</p>
        <span className={`flex size-9 items-center justify-center rounded-lg ${iconColors[icon]}`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{iconPaths[icon]}</svg>
        </span>
      </div>
      <p className="mt-3 text-[26px] font-semibold tracking-[-0.04em] text-slate-900">{metric.value}</p>
      <div className="mt-2 flex items-center gap-1.5 text-[11px]">
        <span className={`inline-flex items-center gap-0.5 font-semibold ${isPositive ? "text-emerald-600" : "text-rose-600"}`} aria-label={`${metric.change} ${isPositive ? "increase" : "decrease"}`}>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="size-3"><path d={isPositive ? "m3 10 5-5 5 5" : "m3 6 5 5 5-5"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {metric.change}
        </span>
        <span className="text-slate-500">{metric.comparison}</span>
      </div>
    </article>
  );
}
