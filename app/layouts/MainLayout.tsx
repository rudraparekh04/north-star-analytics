import type { ReactNode } from "react";
import MainContent from "@/app/components/MainContent";
import Sidebar from "@/app/components/Sidebar";
import type { AuthSession, OrganizationMembership } from "@/app/lib/auth";

export default function MainLayout({
  children,
  session,
  memberships,
}: {
  children: ReactNode;
  session: AuthSession & { organization: OrganizationMembership };
  memberships: OrganizationMembership[];
}) {
  return (
    <div className="min-h-screen bg-[#f7f8fc] md:flex">
      <a href="#main-content" className="sr-only z-50 rounded-md bg-white p-3 text-indigo-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Sidebar session={session} memberships={memberships} />
      <MainContent>{children}</MainContent>
    </div>
  );
}
