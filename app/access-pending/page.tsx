import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import { signOutAction } from "@/app/lib/auth-actions";

export default async function AccessPendingPage() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Membership approval</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Your request is waiting for approval</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {session
            ? "An organization administrator must approve your membership before dashboard data is available."
            : "An organization administrator must approve your membership before you can enter the workspace. Sign in again after approval."}
        </p>
        {session
          ? <form action={signOutAction} className="mt-6"><button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Sign out</button></form>
          : <Link href="/sign-in" className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Sign in</Link>}
      </section>
    </main>
  );
}
