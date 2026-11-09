"use client";

import { useActionState } from "react";
import { createOrganizationAction, type AuthFormState } from "@/app/lib/auth-actions";
import { AuthFeedback } from "@/app/components/SignInForm";

export default function CreateOrganizationForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(createOrganizationAction, {});

  return (
    <form action={formAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="sr-only" htmlFor="organization-name">Organization name</label>
      <input id="organization-name" name="name" required minLength={2} maxLength={80} placeholder="Organization name" className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      <label className="sr-only" htmlFor="organization-slug">Organization URL slug</label>
      <input id="organization-slug" name="slug" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="organization-slug" className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
      <button disabled={pending} className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Creating…" : "Create workspace"}
      </button>
      <div className="sm:col-span-3"><AuthFeedback state={state} /></div>
    </form>
  );
}
