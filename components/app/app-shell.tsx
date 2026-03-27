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
        <aside className="border-b border-white/10 bg-slate-950/40 px-4 py-5 backdrop-blur-xl lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
                Capybara Coach
              </p>
              <h1 className="mt-2 font-display text-2xl font-semibold text-white">
                Study with recall
              </h1>
            </div>
            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs text-slate-200">
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
                    "inline-flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-cyan-400/30 bg-cyan-400/15 text-white"
                      : "text-slate-300 hover:border-white/10 hover:bg-white/6 hover:text-white",
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
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/45 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Web MVP
                </p>
                <p className="mt-1 text-sm text-slate-200">
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
