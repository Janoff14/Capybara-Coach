"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenText, LayoutDashboard, LogOut, NotebookPen } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: BookOpenText },
  { href: "/notes", label: "Notes", icon: NotebookPen },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto min-h-screen max-w-[1600px] lg:grid lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-[var(--border-soft)] bg-[var(--sidebar)] px-4 py-5 backdrop-blur-[8px] lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                Capybara Coach
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[var(--primary)]">
                Study with recall
              </h1>
            </div>
            <div className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs text-[var(--muted-foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {user?.display_name ?? "Student"}
            </div>
          </div>

          <nav className="mt-6 flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-r-4 border-r-[var(--primary)] bg-[var(--sidebar-active)] text-[var(--primary)]"
                      : "text-[var(--muted-foreground)] hover:bg-[rgba(73,102,64,0.05)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 lg:mt-auto lg:pt-10">
            <Button
              variant="secondary"
              className="w-full justify-between"
              onClick={handleLogout}
            >
              Log out
              <LogOut className="size-4" />
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-[var(--border-soft)] bg-[rgba(252,249,248,0.82)] px-4 py-4 backdrop-blur-[8px] sm:px-6 lg:px-10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Web MVP
                </p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Focus on the recall loop: read, explain, assess, save.
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
