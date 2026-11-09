"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type AuthFormState } from "@/app/lib/auth-actions";

export default function SignInForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="mt-7 space-y-5">
      <label className="block space-y-2 text-sm font-medium text-slate-800">
        Email address
        <input required type="email" maxLength={254} name="email" autoComplete="email" placeholder="you@company.com" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
      </label>
      <label className="block space-y-2 text-sm font-medium text-slate-800">
        Password
        <input required type="password" maxLength={1024} name="password" autoComplete="current-password" placeholder="Enter your password" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
      </label>
      <AuthFeedback state={state} />
      <button type="submit" disabled={pending} className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-70">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="border-t border-slate-100 pt-5 text-center text-sm text-slate-600">New to Northstar? <Link href="/sign-up" className="font-semibold text-indigo-700 underline-offset-4 hover:text-indigo-800 hover:underline">Create an account</Link></p>
    </form>
  );
}

export function AuthFeedback({ state }: { state: AuthFormState }) {
  return (
    <>
      {state.error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</p>}
      {state.message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>}
    </>
  );
}
