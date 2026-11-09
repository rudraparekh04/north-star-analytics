export default function Loading() {
  return (
    <main aria-label="Loading analytics dashboard" aria-busy="true" className="min-h-screen bg-[#f7f8fc] p-5 pt-20 sm:p-8">
      <div className="mx-auto max-w-[1440px] animate-pulse space-y-6">
        <div className="space-y-2"><div className="h-3 w-24 rounded bg-slate-200" /><div className="h-7 w-64 rounded bg-slate-200" /><div className="h-4 w-80 max-w-full rounded bg-slate-200" /></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-xl border border-slate-200 bg-white" />)}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]"><div className="h-80 rounded-xl border border-slate-200 bg-white" /><div className="h-80 rounded-xl border border-slate-200 bg-white" /></div>
        <div className="h-72 rounded-xl border border-slate-200 bg-white" />
      </div>
      <span className="sr-only">Loading dashboard data…</span>
    </main>
  );
}
