"use client";

import { useEffect, useState } from "react";
import DataTable from "@/app/components/DataTable";
import WelcomeToast from "@/app/components/WelcomeToast";
import KPICard from "@/app/components/KPIcard";
import LineChart from "@/app/components/LineChart";
import BreakdownWidget from "@/app/components/BreakdownWidget";
import type { DashboardAnalytics, SalesGranularity, TransactionFilters, TransactionPage } from "@/app/lib/transaction-queries";
import type { UserRole } from "@/app/types/dashboard";

const widgetIds = ["metrics", "trend", "categories", "regions", "products", "transactions"] as const;
type WidgetId = (typeof widgetIds)[number];
type WidgetVisibility = Record<WidgetId, boolean>;

const defaultWidgets: WidgetVisibility = {
  metrics: true,
  trend: true,
  categories: true,
  regions: true,
  products: true,
  transactions: true,
};

const widgetLabels: Record<WidgetId, string> = {
  metrics: "Key performance indicators",
  trend: "Sales trends",
  categories: "Revenue by category",
  regions: "Revenue by region",
  products: "Top-selling products",
  transactions: "Recent transactions",
};

const granularityOptions: { value: SalesGranularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

interface DashboardViewProps {
  role: UserRole;
  userName: string;
  analytics: DashboardAnalytics;
  transactionPage: TransactionPage;
  filters: TransactionFilters;
  granularity: SalesGranularity;
  welcome: boolean;
  invalidRange: boolean;
}

export default function DashboardView({
  role,
  userName,
  analytics,
  transactionPage,
  filters,
  granularity,
  welcome,
  invalidRange,
}: DashboardViewProps) {
  const [widgets, setWidgets] = useState<WidgetVisibility>(defaultWidgets);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);
  const canViewAnalytics = role !== "viewer";
  const availableWidgets: WidgetId[] = canViewAnalytics ? [...widgetIds] : ["transactions"];
  const storageKey = `northstar-dashboard-widgets:${role}`;

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) {
      const savedIds = new Set(stored.split(","));
      setWidgets(widgetIds.reduce<WidgetVisibility>((visibility, id) => {
        visibility[id] = savedIds.has(id);
        return visibility;
      }, { ...defaultWidgets }));
    }
    setPreferencesLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (preferencesLoaded) {
      const visibleIds = widgetIds.filter((id) => widgets[id]);
      window.localStorage.setItem(storageKey, visibleIds.join(","));
    }
  }, [preferencesLoaded, storageKey, widgets]);

  function toggleWidget(widget: WidgetId) {
    setWidgets((current) => ({ ...current, [widget]: !current[widget] }));
  }

  return (
    <div id="overview" className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-20 sm:px-7 sm:pt-8 lg:px-10">
      {welcome && <WelcomeToast name={userName} />}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-slate-500">Workspace <span aria-hidden="true" className="px-1">/</span> Overview</p>
          <h1 className="text-[25px] font-semibold tracking-[-0.04em] text-slate-900">Good morning, {userName} <span aria-hidden="true">✦</span></h1>
          <p className="mt-1.5 text-[13px] text-slate-500">A clear view of your store performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/" method="get" className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <label className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">From</span>
              <input aria-label="Start date" required type="date" name="from" defaultValue={analytics.startDate} className="h-8 min-w-0 bg-transparent text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-200" />
            </label>
            <span aria-hidden="true" className="text-slate-300">–</span>
            <label className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">To</span>
              <input aria-label="End date" required type="date" name="to" defaultValue={analytics.endDate} className="h-8 min-w-0 bg-transparent text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-200" />
            </label>
            <label className="sr-only" htmlFor="sales-granularity">Sales trend interval</label>
            <select id="sales-granularity" name="granularity" defaultValue={granularity} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
              {granularityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="submit" className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
              Apply
            </button>
          </form>

          <div className="relative">
            <button
              type="button"
              aria-expanded={showWidgetSettings}
              aria-controls="widget-settings"
              onClick={() => setShowWidgetSettings((open) => !open)}
              className="flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(16,24,40,0.03)] hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="white" /><circle cx="15" cy="12" r="2" fill="white" /><circle cx="10" cy="18" r="2" fill="white" /></svg>
              Customize
            </button>
            {showWidgetSettings && (
              <fieldset id="widget-settings" className="absolute right-0 top-14 z-20 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                <legend className="px-1 text-xs font-semibold text-slate-900">Dashboard widgets</legend>
                <div className="mt-2 space-y-3">
                  {availableWidgets.map((widget) => (
                    <label key={widget} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                      <input type="checkbox" checked={widgets[widget]} onChange={() => toggleWidget(widget)} className="size-4 rounded border-slate-300 accent-indigo-600" />
                      {widgetLabels[widget]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </div>
      </header>

      {invalidRange && (
        <p role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Choose a valid date range with the start date on or before the end date. The default range is shown below.
        </p>
      )}

      {canViewAnalytics && widgets.metrics && (
        <section aria-label="Key performance indicators" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {analytics.metrics.map((metric, index) => {
            const icons = ["revenue", "orders", "users", "conversion"] as const;
            return <KPICard key={metric.label} metric={metric} icon={icons[index]} />;
          })}
        </section>
      )}

      {canViewAnalytics && widgets.trend && (
        <div id="analytics" className="mt-5">
          <LineChart data={analytics.trend} granularity={granularity} />
        </div>
      )}

      {canViewAnalytics && (widgets.categories || widgets.regions || widgets.products) && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {widgets.categories && (
            <BreakdownWidget
              id="categories"
              title="Revenue by category"
              description="Net revenue and order count"
              items={analytics.categories}
              emptyMessage="No category data for this date range."
            />
          )}
          {widgets.regions && (
            <BreakdownWidget
              id="regions"
              title="Revenue by region"
              description="Net revenue and order count"
              items={analytics.regions}
              emptyMessage="No regional data for this date range."
            />
          )}
          {widgets.products && (
            <BreakdownWidget
              id="top-products"
              title="Top-selling products"
              description="Ranked by paid order count"
              items={analytics.topProducts}
              emptyMessage="No product sales for this date range."
            />
          )}
        </div>
      )}

      {widgets.transactions && (
        <div id="transactions" className="mt-5">
          <DataTable page={transactionPage} filters={filters} showAllOrdersLink />
        </div>
      )}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <p>© 2024 Northstar Analytics. All rights reserved.</p>
        <p>Showing {analytics.startDate} to {analytics.endDate}</p>
      </footer>
    </div>
  );
}
