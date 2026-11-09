import Link from "next/link";
import type { ReactNode } from "react";

interface AuthPageShellProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export default function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
}: AuthPageShellProps) {
  return (
    <main className="min-h-screen bg-slate-100 p-0 sm:p-4 lg:p-6">
      <section
        aria-labelledby="auth-page-title"
        className="mx-auto grid min-h-screen w-full max-w-[1440px] overflow-hidden bg-white shadow-2xl shadow-slate-300/50 sm:min-h-[calc(100vh-2rem)] sm:rounded-[28px] lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.05fr_0.95fr]"
      >
        <div className="relative isolate flex min-h-[390px] flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-900 px-6 py-7 text-white sm:px-10 sm:py-9 lg:min-h-[760px] lg:px-14 lg:py-11">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 -top-32 -z-10 size-[420px] rounded-full bg-indigo-400/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-48 -left-36 -z-10 size-[440px] rounded-full bg-cyan-400/10 blur-3xl"
          />

          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-lg font-semibold tracking-tight text-white shadow-sm"
            >
              n
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.03em] text-white">
              northstar
            </span>
          </Link>

          <div className="mt-10 sm:mt-14 lg:mt-20">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium tracking-wide text-indigo-100">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-cyan-300" />
              YOUR BUSINESS, IN FOCUS
            </p>
            <h2 className="mt-5 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-4xl lg:text-[42px]">
              Clarity for every decision.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100/80 sm:text-base sm:leading-7">
              Bring your organization&apos;s performance into one clear view and
              give your team room to move forward.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-white/15 bg-white/[0.08] p-4 shadow-2xl shadow-slate-950/20 backdrop-blur-sm sm:mt-10 sm:p-5 lg:mt-12">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Performance overview</p>
                <p className="mt-1 text-xs text-indigo-100/70">A snapshot of your key signals</p>
              </div>
              <span className="rounded-lg border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-indigo-100/80">
                Last 30 days
              </span>
            </div>
            <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-slate-950/20 px-3 pb-3 pt-4 sm:px-4">
              <div className="flex items-center justify-between text-[10px] text-indigo-100/50">
                <span>Trend</span>
                <span>Illustrative preview</span>
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 520 132"
                className="mt-3 h-28 w-full overflow-visible sm:h-32"
                fill="none"
                preserveAspectRatio="none"
              >
                <path d="M0 24H520M0 64H520M0 104H520" stroke="white" strokeOpacity=".1" strokeDasharray="3 6" />
                <path
                  d="M0 91C34 89 40 77 72 80S119 98 151 73 202 63 228 68 276 46 306 56 356 44 380 49 424 25 450 38 493 16 520 21V132H0V91Z"
                  fill="url(#chart-fill)"
                />
                <path
                  d="M0 91C34 89 40 77 72 80S119 98 151 73 202 63 228 68 276 46 306 56 356 44 380 49 424 25 450 38 493 16 520 21"
                  stroke="#A5F3FC"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M0 101C35 97 48 107 77 95S126 89 152 98 203 77 231 85 277 72 306 82 353 68 383 77 427 60 453 67 493 50 520 54"
                  stroke="#C4B5FD"
                  strokeOpacity=".85"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="5 6"
                />
                <defs>
                  <linearGradient id="chart-fill" x1="260" y1="16" x2="260" y2="132" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#67E8F9" stopOpacity=".24" />
                    <stop offset="1" stopColor="#67E8F9" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-indigo-100/75">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-cyan-200" />
                  Revenue
                </span>
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-violet-300" />
                  Engagement
                </span>
              </div>
            </div>
          </div>

          <div className="mt-auto hidden pt-8 text-xs text-indigo-100/60 lg:block">
            A more thoughtful way to understand your business.
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-center px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14 xl:px-16">
          <div className="w-full max-w-[440px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                {eyebrow}
              </p>
              <h1
                id="auth-page-title"
                className="mt-3 text-[30px] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[34px]"
              >
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">
                  {description}
                </p>
              )}
            </div>

            {children}

            <p className="mt-7 text-center text-xs text-slate-500">
              Secure access to your organization workspace
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
