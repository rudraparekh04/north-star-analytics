import { redirect } from "next/navigation";
import { selectOrganizationAction, signOutAction } from "@/app/lib/auth-actions";
import { getOrganizationMemberships, getSession } from "@/app/lib/auth";

interface SelectOrganizationPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SelectOrganizationPage({ searchParams }: SelectOrganizationPageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const memberships = await getOrganizationMemberships(session.userId);
  if (session.organization) redirect("/");
  if (!memberships.length) redirect("/access-pending");
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fc] px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Choose a workspace</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Your account has access to more than one organization.</p>
        {params.error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">That membership is no longer active. Choose an available workspace.</p>}
        <div className="mt-6 space-y-3">
          {memberships.map((membership) => (
            <form key={membership.id} action={selectOrganizationAction}>
              <input type="hidden" name="organizationId" value={membership.id} />
              <button type="submit" className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{membership.name}</span>
                  <span className="mt-0.5 block text-xs capitalize text-slate-600">{membership.role}</span>
                </span>
                <span aria-hidden="true" className="text-indigo-700">→</span>
              </button>
            </form>
          ))}
        </div>
        <form action={signOutAction} className="mt-6"><button className="text-sm font-medium text-indigo-700 hover:text-indigo-800">Sign out</button></form>
      </section>
    </main>
  );
}
