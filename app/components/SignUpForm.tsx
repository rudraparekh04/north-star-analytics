"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type AuthFormState } from "@/app/lib/auth-actions";
import type { OrganizationOption } from "@/app/lib/organization-queries";
import { AuthFeedback } from "@/app/components/SignInForm";

export default function SignUpForm({ organizations }: { organizations: OrganizationOption[] }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUpAction, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block space-y-2 text-sm font-medium text-slate-800">
        Full name
        <input required minLength={2} maxLength={60} name="name" autoComplete="name" placeholder="Your name" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
      </label>
      <label className="block space-y-2 text-sm font-medium text-slate-800">
        Work email
        <input required type="email" maxLength={254} name="email" autoComplete="email" placeholder="you@company.com" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
      </label>
      <label className="block space-y-2 text-sm font-medium text-slate-800">
        Organization
        <select required name="organization" defaultValue="" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
          <option value="" disabled>Select an organization</option>
          {organizations.map((organization) => <option key={organization.id} value={organization.slug}>{organization.name}</option>)}
        </select>
      </label>
      <label className="block space-y-2 text-sm font-medium text-slate-800">
        Password
        <input required type="password" minLength={12} maxLength={72} name="password" autoComplete="new-password" aria-describedby="password-requirement" placeholder="Create a password" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
        <span id="password-requirement" className="block text-xs font-normal text-slate-600">Use at least 12 characters.</span>
      </label>
      <AuthFeedback state={state} />
      <p className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3.5 py-3 text-xs leading-5 text-slate-700">Your request starts with viewer access. An organization admin must approve it before you can enter the workspace. Password recovery is handled by your admin.</p>
      {organizations.length === 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">No organizations are available for registration yet.</p>}
      <button type="submit" disabled={pending || organizations.length === 0} className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-70">
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="border-t border-slate-100 pt-4 text-center text-sm text-slate-600">Already have an account? <Link href="/sign-in" className="font-semibold text-indigo-700 underline-offset-4 hover:text-indigo-800 hover:underline">Sign in</Link></p>
    </form>
  );
}
