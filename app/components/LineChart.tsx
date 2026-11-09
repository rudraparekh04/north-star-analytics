"use client";

import { useState, type PointerEvent } from "react";
import type { RevenuePoint } from "@/app/types/dashboard";

interface LineChartProps {
  data: RevenuePoint[];
  granularity: "daily" | "weekly" | "monthly";
}

const chartWidth = 640;
const chartTop = 14;
const chartBottom = 194;
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function getX(index: number, length: number) {
  return 4 + (index / Math.max(length - 1, 1)) * (chartWidth - 8);
}

function getY(value: number, minimum: number, maximum: number) {
  return chartBottom - ((value - minimum) / (maximum - minimum)) * (chartBottom - chartTop);
}

export default function LineChart({ data, granularity }: LineChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const values = data.map((point) => point.revenue);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const range = maximum - minimum || 1;
  const points = values
    .map((value, index) => `${getX(index, values.length)},${getY(value, minimum, maximum)}`)
    .join(" ");
  const activePoint = activeIndex === null ? null : data[activeIndex];
  const activeX = activeIndex === null ? null : getX(activeIndex, data.length);

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (data.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0) return;
    const chartPosition = (event.clientX - bounds.left) / bounds.width;
    setActiveIndex(Math.round(Math.max(0, Math.min(1, chartPosition)) * (data.length - 1)));
  }

  return (
    <section aria-labelledby="revenue-chart-title" className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="revenue-chart-title" className="text-sm font-semibold text-slate-900">Sales trends</h2>
          <p className="mt-1 text-xs text-slate-500">Net revenue by {granularity} period</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <span aria-hidden="true" className="size-2 rounded-full bg-indigo-500" />
          Revenue
        </span>
      </div>
      {data.length > 0 ? (
        <div className="mt-7 flex gap-3">
          <div aria-hidden="true" className="flex h-[220px] shrink-0 flex-col justify-between pb-3 text-[10px] text-slate-500">
            {[4, 3, 2, 1, 0].map((step) => (
              <span key={step}>{currency.format(minimum + range * step / 4)}</span>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <svg
              role="group"
              aria-labelledby="revenue-chart-title"
              aria-describedby="revenue-chart-description"
              viewBox="0 0 640 220"
              preserveAspectRatio="none"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setActiveIndex(null)}
              className="h-[220px] w-full overflow-visible"
            >
              <desc id="revenue-chart-description">
                {data.map((point) => `${point.label}: revenue ${currency.format(point.revenue)}`).join(". ")}
              </desc>
              {[14, 59, 104, 149, 194].map((y) => (
                <line key={y} x1="0" x2="640" y1={y} y2={y} stroke="#eef0f5" strokeDasharray="3 5" />
              ))}
              {data.map((point, index) => {
                const x = getX(index, data.length);
                const slotWidth = chartWidth / data.length;
                return (
                  <rect
                    key={point.label}
                    x={Math.max(0, x - slotWidth / 2)}
                    y={chartTop}
                    width={Math.min(slotWidth, chartWidth - Math.max(0, x - slotWidth / 2))}
                    height={chartBottom - chartTop}
                    fill="transparent"
                    role="button"
                    tabIndex={0}
                    aria-label={`${point.label}: revenue ${currency.format(point.revenue)}`}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                    onClick={() => setActiveIndex(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveIndex(index);
                      }
                    }}
                    className="focus-visible:fill-indigo-100/40"
                  />
                );
              })}
              {activeX !== null && (
                <line x1={activeX} x2={activeX} y1={chartTop} y2={chartBottom} stroke="#94a3b8" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
              )}
              {data.length > 1 && (
                <polyline points={points} fill="none" stroke="#635bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              )}
              {data.map((point, index) => (
                <circle
                  key={point.label}
                  cx={getX(index, data.length)}
                  cy={getY(point.revenue, minimum, maximum)}
                  r={activeIndex === index ? 5 : 3}
                  fill="white"
                  stroke="#635bff"
                  strokeWidth="2"
                  pointerEvents="none"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {activePoint && activeX !== null && (
              <div
                role="status"
                className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg"
                style={{
                  left: `${activeX / chartWidth * 100}%`,
                  transform: activeX < 100 ? "translateX(0)" : activeX > 540 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                <p className="mb-1.5 text-[11px] font-semibold text-slate-800">{activePoint.label}</p>
                <p className="flex items-center justify-between gap-4 text-[11px]">
                  <span className="text-slate-600">Revenue</span>
                  <span className="font-semibold text-slate-800">{currency.format(activePoint.revenue)}</span>
                </p>
              </div>
            )}
            <div aria-hidden="true" className="mt-2 flex justify-between gap-2 text-[10px] text-slate-500">
              {data
                .filter((_, index) => {
                  const interval = Math.max(1, Math.ceil(data.length / 6));
                  return index % interval === 0 || index === data.length - 1;
                })
                .map((point) => <span key={point.label} className="truncate">{point.label}</span>)}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-7 rounded-lg bg-slate-50 px-3 py-10 text-center text-xs text-slate-500">
          No sales for this date range.
        </p>
      )}
    </section>
  );
}
