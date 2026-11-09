"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOutAction, switchOrganizationAction } from "@/app/lib/auth-actions";
import type { AuthSession, OrganizationMembership } from "@/app/lib/auth";

const navigation = [
  { label: "Overview", href: "/", icon: "grid" },
  { label: "Analytics", href: "/#analytics", icon: "chart" },
  { label: "Orders", href: "/orders", icon: "document" },
  { label: "Customers", href: "/customers", icon: "users" },
  { label: "Products", href: "/products", icon: "document" },
  { label: "Reports", href: "/#traffic", icon: "document" },
] as const;

function NavigationIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">
      {paths[name]}
    </svg>
  );
}

export default function Sidebar({
  session,
  memberships,
}: {
  session: AuthSession & { organization: OrganizationMembership };
  memberships: OrganizationMembership[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const visibleNavigation = session.organization.role === "viewer"
    ? navigation.filter((item) => item.label === "Overview" || item.label === "Orders" || item.label === "Customers" || item.label === "Products")
    : session.organization.role === "admin"
      ? [...navigation, { label: "Members", href: "/admin", icon: "users" as const }]
      : navigation;

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
          {isOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/30 md:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Link href="/" onClick={() => setIsOpen(false)} className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-6">
          <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2">
              <path d="M4 17.5 9 12l3.5 3.5L20 7" /><path d="M15 7h5v5" />
            </svg>
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-slate-900">northstar</span>
          <span className="ml-auto rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pro</span>
        </Link>

        <div className="px-4 pt-7">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Workspace</p>
          {memberships.length > 1 && (
            <form action={switchOrganizationAction} className="mt-3 space-y-2 px-2">
              <label className="sr-only" htmlFor="active-organization">Active organization</label>
              <select id="active-organization" name="organizationId" defaultValue={session.organization.id} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                {memberships.map((membership) => <option key={membership.id} value={membership.id}>{membership.name} · {membership.role}</option>)}
              </select>
              <button type="submit" className="w-full rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-800 hover:bg-indigo-100">Switch workspace</button>
            </form>
          )}
          <nav aria-label="Main navigation" className="mt-3 space-y-1">
            {visibleNavigation.map((item) => {
              const isActive = item.href === "/"
                ? pathname === "/"
                : item.href === "/orders"
                  ? pathname.startsWith("/orders")
                  : item.href === "/customers"
                    ? pathname.startsWith("/customers")
                    : item.href === "/products"
                      ? pathname.startsWith("/products")
                  : item.href === "/admin" && pathname === "/admin";
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                >
                  <NavigationIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold uppercase text-amber-800" aria-hidden="true">{session.fullName.slice(0, 2)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800">{session.fullName}</p>
              <p className="truncate text-[11px] text-slate-500">{session.email}</p>
              <p className="mt-0.5 text-[10px] font-medium capitalize text-indigo-700">{session.organization.role}</p>
            </div>
            <form action={signOutAction}>
              <button type="submit" aria-label="Sign out" className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
