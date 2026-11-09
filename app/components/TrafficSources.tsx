import type { TrafficSource } from "@/app/types/dashboard";

export default function TrafficSources({ sources }: { sources: TrafficSource[] }) {
  const total = sources.reduce((sum, source) => sum + source.value, 0);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  return (
    <section id="traffic" aria-labelledby="traffic-title" className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:p-6">
      <h2 id="traffic-title" className="text-sm font-semibold text-slate-900">Traffic sources</h2>
      <p className="mt-1 text-xs text-slate-500">Where your visitors come from</p>
      <div className="mt-5 flex items-center justify-center">
        <svg role="img" aria-labelledby="traffic-title traffic-description" viewBox="0 0 120 120" className="size-40 -rotate-90">
          <desc id="traffic-description">{sources.map((source) => `${source.label}: ${source.value}%`).join(", ")}</desc>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f3f8" strokeWidth="13" />
          {sources.map((source, index) => {
            const length = (source.value / total) * circumference;
            const currentOffset = sources
              .slice(0, index)
              .reduce((sum, previous) => sum + (previous.value / total) * circumference, 0);
            return (
              <circle
                key={source.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={source.color}
                strokeWidth="13"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
          <text x="60" y="58" textAnchor="middle" className="fill-slate-900" fontSize="18" fontWeight="600" transform="rotate(90 60 60)">{total}%</text>
          <text x="60" y="73" textAnchor="middle" className="fill-slate-500" fontSize="8" transform="rotate(90 60 60)">TOTAL SESSIONS</text>
        </svg>
      </div>
      <ul className="mt-3 space-y-3">
        {sources.map((source) => (
          <li key={source.label} className="flex items-center gap-2 text-xs">
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: source.color }} />
            <span className="flex-1 text-slate-500">{source.label}</span>
            <span className="font-semibold text-slate-700">{source.value}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
