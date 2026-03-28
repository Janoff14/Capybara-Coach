import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  mode: "login" | "register";
  children: React.ReactNode;
};

export function AuthShell({
  title,
  description,
  mode,
  children,
}: AuthShellProps) {
  const isLogin = mode === "login";

  if (isLogin) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
        <div className="pointer-events-none absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-[rgba(253,218,178,0.22)] blur-[96px]" />
        <div className="pointer-events-none absolute -right-24 top-0 h-[28rem] w-[28rem] rounded-full bg-[rgba(205,235,197,0.28)] blur-[120px]" />

        <main className="relative z-10 grid w-full max-w-[1200px] overflow-hidden rounded-[32px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.86)] shadow-[var(--shadow-panel)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden min-h-[720px] overflow-hidden bg-[linear-gradient(180deg,#4b6648_0%,#40593d_100%)] p-12 text-white lg:flex lg:flex-col">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(253,218,178,0.16),transparent_34%)]" />
            <div className="absolute right-10 top-10 h-32 w-32 rounded-full border border-white/12" />
            <div className="absolute bottom-12 left-12 h-20 w-20 rounded-3xl bg-white/8 backdrop-blur-sm" />

            <div className="relative z-10 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                <span className="text-xl font-bold">C</span>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold tracking-[-0.05em]">
                  Capybara Coach
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                  Recall-first study loop
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-auto max-w-md">
              <div className="mb-6 inline-flex rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                Guided reading, recall, notes
              </div>
              <h2 className="font-display text-5xl font-extrabold tracking-[-0.06em] text-balance">
                Master your recall loop without losing calm.
              </h2>
              <p className="mt-5 text-base leading-8 text-white/76">
                Read the source, explain it back from memory, get useful
                feedback, and turn the result into notes and practice that you
                can revisit later.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Read", value: "Source-first" },
                  { label: "Recall", value: "Voice coaching" },
                  { label: "Review", value: "Notes + cards" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/66">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-center bg-[rgba(255,255,255,0.72)] px-8 py-10 sm:px-12 lg:px-16">
            <div className="lg:hidden">
              <Link href="/login" className="inline-flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-sm font-bold text-white">
                  C
                </div>
                <div>
                  <p className="font-display text-xl font-extrabold tracking-[-0.04em] text-[var(--primary)]">
                    Capybara Coach
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    Recall-first study loop
                  </p>
                </div>
              </Link>
            </div>

            <header className="mb-10 mt-8 lg:mt-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Welcome back
              </p>
              <h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.05em] text-[var(--foreground)]">
                {title}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-7 text-[var(--foreground-soft)]">
                {description}
              </p>
            </header>

            <div className="space-y-6">{children}</div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-14">
      <div className="pointer-events-none absolute -left-12 -top-12 h-80 w-80 rounded-full bg-[rgba(205,235,197,0.28)] blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[rgba(212,228,246,0.24)] blur-[96px]" />
      <div className="pointer-events-none absolute -right-12 top-1/3 h-64 w-64 rounded-full bg-[rgba(253,218,178,0.2)] blur-[88px]" />

      <main className="relative z-10 w-full max-w-xl">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-[20px] bg-[rgba(255,255,255,0.9)] shadow-[var(--shadow-soft)]">
            <span className="font-display text-2xl font-extrabold text-[var(--primary)]">C</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.05em] text-[var(--foreground)]">
            Capybara Coach
          </h1>
          <p className="mt-3 text-base text-[var(--foreground-soft)]">
            Build a cleaner recall habit with a calmer study workspace.
          </p>
        </div>

        <div className="editorial-panel rounded-[28px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.88)] p-8 sm:p-10">
          <header className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Join the workspace
            </p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.05em] text-[var(--foreground)]">
              {title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground-soft)]">
              {description}
            </p>
          </header>

          <div className="space-y-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
