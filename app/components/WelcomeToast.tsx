"use client";

import { useEffect, useState } from "react";

export default function WelcomeToast({ name }: { name: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div role="status" className="fixed right-5 top-5 z-50 flex items-center gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
      <span>Signed in to the demo workspace as {name}.</span>
      <button type="button" aria-label="Dismiss notification" onClick={() => setVisible(false)} className="rounded px-1 text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">×</button>
    </div>
  );
}
