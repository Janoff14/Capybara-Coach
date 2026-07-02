"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpenText,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  NotebookPen,
  PanelsTopLeft,
  Search,
} from "lucide-react";

import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: BookOpenText },
  { href: "/capture", label: "Read & note", icon: MessageSquareText },
  { href: "/practice", label: "Practice", icon: PanelsTopLeft },
  { href: "/notes", label: "Notes", icon: NotebookPen },
];

function getRouteMeta(pathname: string) {
  if (pathname.startsWith("/capture")) {
    return {
      title: "Read & note",
      description: "Choose a textbook and take categorized notes beside the page.",
      active: "/capture",
    };
  }

  if (pathname.startsWith("/documents")) {
    return {
      title: "Documents",
      description: "Upload source material and turn it into guided study sessions.",
      active: "/documents",
    };
  }

  if (pathname.startsWith("/practice")) {
    return {
      title: "Practice",
      description: "Use flashcards and review schedules to keep recall active.",
      active: "/practice",
    };
  }

  if (pathname.startsWith("/notes")) {
    return {
      title: "Notes",
      description: "Revisit the clean outputs generated from assessed recall sessions.",
      active: "/notes",
    };
  }

  if (pathname.includes("/study/") && pathname.endsWith("/read")) {
    return {
      title: "Reader mode",
      description: "Keep the real source in view while the study guidance stays restrained.",
      active: "/documents",
    };
  }

  if (pathname.includes("/study/") && pathname.endsWith("/capture")) {
    return {
      title: "Read & note",
      description: "Keep the textbook open while you build a categorized study trail beside it.",
      active: "/capture",
    };
  }

  if (pathname.includes("/study/") && pathname.endsWith("/record")) {
    return {
      title: "Recall mode",
      description: "Explain the material from memory and let the coach step in only when needed.",
      active: "/documents",
    };
  }

  if (pathname.includes("/study/") && pathname.endsWith("/assessment")) {
    return {
      title: "Assessment",
      description: "Review coverage, weak points, strictness, and the next study step.",
      active: "/documents",
    };
  }

  return {
    title: "Dashboard",
    description: "Your current study loop, recent sessions, and retention queue.",
    active: "/dashboard",
  };
}

function getInitials(name?: string | null) {
  if (!name) {
    return "CC";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const routeMeta = getRouteMeta(pathname);
  const isCaptureMode = pathname.includes("/study/") && pathname.endsWith("/capture");

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-[var(--border-soft)] bg-[var(--sidebar)] px-4 py-8 backdrop-blur-xl lg:flex">
        <div className="mb-10 px-4">
          <Link href="/dashboard">
            <h1 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-[var(--primary)]">
              Capybara Coach
            </h1>
          </Link>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Study with recall
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = routeMeta.active === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "border-r-4 border-[var(--primary)] bg-[var(--sidebar-active)] text-[var(--primary)]"
                    : "text-[var(--secondary)] hover:bg-[rgba(75,102,72,0.05)] hover:text-[var(--primary)]",
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-4 px-4 pt-6">
          <UploadDocumentDialog buttonLabel="New entry" />

          <div className="rounded-2xl bg-[var(--panel-soft)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold uppercase tracking-[0.18em] text-white">
                {getInitials(user?.display_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--foreground)]">
                  {user?.display_name ?? "Capybara Coach"}
                </p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {user?.email ?? "study@mvp.local"}
                </p>
              </div>
            </div>
          </div>

          <Button variant="ghost" className="w-full justify-between" onClick={handleLogout}>
            Log out
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 border-b border-[var(--border-soft)] bg-[rgba(250,249,244,0.84)] px-6 py-4 backdrop-blur-xl lg:left-64 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-[var(--primary)]">{routeMeta.title}</p>
            <p className="mt-1 hidden text-sm text-[var(--muted-foreground)] md:block">
              {routeMeta.description}
            </p>
          </div>

          <div className="hidden min-w-[320px] items-center rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-2.5 md:flex lg:min-w-[420px]">
            <Search className="mr-2 size-4 text-[var(--muted-foreground)]" />
            <input
              className="w-full border-none bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
              placeholder="Search knowledge base..."
              type="text"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              className="rounded-full p-2 text-[var(--primary)] transition-colors hover:bg-[rgba(75,102,72,0.06)]"
              type="button"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
            </button>
            <div className="hidden h-8 w-px bg-[var(--border-soft)] sm:block" />
            <div className="hidden rounded-full border border-[var(--border-soft)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground-soft)] sm:block">
              {user?.display_name ?? "Student"}
            </div>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "px-6 pb-28 pt-24 lg:pl-[19rem] lg:pr-8 lg:pt-24",
          isCaptureMode && "lg:pr-5",
        )}
      >
        <div className={cn("mx-auto", isCaptureMode ? "max-w-[1700px]" : "max-w-7xl")}>
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[var(--border-soft)] bg-[rgba(250,249,244,0.94)] px-2 py-2 backdrop-blur-xl lg:hidden">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = routeMeta.active === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em]",
                isActive ? "text-[var(--primary)]" : "text-[var(--secondary)]",
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
