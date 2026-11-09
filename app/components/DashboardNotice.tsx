export function DatabaseSetupNotice({ message }: { message: string }) {
  return (
    <section role="alert" className="mx-auto mt-10 max-w-2xl rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Database setup required</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Configure <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">DATABASE_URL</code> and reload this page.
      </p>
    </section>
  );
}
