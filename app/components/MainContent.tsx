import type { ReactNode } from "react";

export default function MainContent({ children }: { children: ReactNode }) {
  return <main id="main-content" className="min-w-0 flex-1 overflow-x-hidden">{children}</main>;
}
