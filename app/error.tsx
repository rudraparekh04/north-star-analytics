"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5 py-12">
      <section role="alert" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18.6A1.6 1.6 0 0 0 3.2 21h17.6a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" /></svg>
        </div>
        <h1 className="mt-5 text-lg font-semibold text-slate-900">We couldn&apos;t load your dashboard</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">We couldn&apos;t load your dashboard data. Check your database connection and try again.</p>
        <button type="button" onClick={reset} className="mt-6 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2">
          Try again
        </button>
      </section>
    </main>
  );
}
