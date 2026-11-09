import { redirect } from "next/navigation";
import CreateOrganizationForm from "@/app/components/CreateOrganizationForm";
import MainLayout from "@/app/layouts/MainLayout";
import {
  getOrganizationMemberships,
  requireAdminSession,
} from "@/app/lib/auth";
import { getOrganizationMembers } from "@/app/lib/organization-queries";
import { resetMemberPasswordAction, updateMembershipAction } from "@/app/lib/auth-actions";
import { roles } from "@/app/lib/auth";

interface AdminPageProps {
  searchParams: Promise<{ error?: string; updated?: string; passwordUpdated?: string }>;
}

const errorMessages: Record<string, string> = {
  member: "That user is not a member of this organization.",
  "last-admin": "The organization must always have at least one active admin.",
  action: "That membership action is invalid.",
  password: "Use a password between 12 and 72 characters.",
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await requireAdminSession();
  const [members, memberships, params] = await Promise.all([
    getOrganizationMembers(session.organization.id),
    getOrganizationMemberships(session.userId),
    searchParams,
  ]);
  if (!memberships.some((membership) => membership.id === session.organization.id)) redirect("/select-organization");
  const errorMessage = params.error ? errorMessages[params.error] : undefined;

  return (
    <MainLayout session={session} memberships={memberships}>
      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 pt-20 sm:px-7 sm:pt-8 lg:px-10">
        <p className="mb-1.5 text-[11px] font-medium text-slate-500">{session.organization.name} <span aria-hidden="true" className="px-1">/</span> Administration</p>
        <h1 className="text-[25px] font-semibold tracking-[-0.04em] text-slate-900">Members and access</h1>
        <p className="mt-1.5 text-[13px] text-slate-600">Approve requests and assign organization-specific roles.</p>
        {errorMessage && <p role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</p>}
        {params.updated && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Member access updated.</p>}
        {params.passwordUpdated && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Member password reset. Their existing sessions have been revoked.</p>}

        <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Organization members</h2>
            <p className="mt-1 text-xs text-slate-600">New membership requests default to viewer access.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((member) => (
              <article key={member.userId} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{member.fullName}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{member.email}</p>
                  <p className="mt-1 text-xs capitalize text-slate-600">
                    {member.status} · {member.role}
                  </p>
                </div>
                {member.status === "pending" ? (
                  <div className="flex gap-2">
                    <form action={updateMembershipAction}>
                      <input type="hidden" name="userId" value={member.userId} />
                      <input type="hidden" name="action" value="approve" />
                      <button className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700">Approve as viewer</button>
                    </form>
                    <form action={updateMembershipAction}>
                      <input type="hidden" name="userId" value={member.userId} />
                      <input type="hidden" name="action" value="reject" />
                      <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Reject</button>
                    </form>
                  </div>
                ) : member.status === "active" ? (
                  <div className="flex flex-wrap gap-3">
                    <form action={updateMembershipAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={member.userId} />
                      <input type="hidden" name="action" value="change-role" />
                      <label className="sr-only" htmlFor={`role-${member.userId}`}>Role for {member.fullName}</label>
                      <select id={`role-${member.userId}`} name="role" defaultValue={member.role} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs capitalize text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                      <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Save role</button>
                    </form>
                    <form action={resetMemberPasswordAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={member.userId} />
                      <label className="sr-only" htmlFor={`password-${member.userId}`}>New password for {member.fullName}</label>
                      <input id={`password-${member.userId}`} name="password" type="password" minLength={12} maxLength={72} required placeholder="New password" className="h-9 w-36 rounded-lg border border-slate-200 px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600" />
                      <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Reset password</button>
                    </form>
                  </div>
                ) : (
                  <form action={updateMembershipAction}>
                    <input type="hidden" name="userId" value={member.userId} />
                    <input type="hidden" name="action" value="approve" />
                    <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Restore as viewer</button>
                  </form>
                )}
              </article>
            ))}
            {members.length === 0 && <p className="px-5 py-8 text-sm text-slate-600">No members have requested access yet.</p>}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Create another organization</h2>
          <p className="mt-1 text-xs text-slate-600">You’ll become an admin of the new isolated workspace.</p>
          <CreateOrganizationForm />
        </section>
      </div>
    </MainLayout>
  );
}
