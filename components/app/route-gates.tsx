"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { LoadingScreen } from "@/components/app/loading-screen";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

function AuthUnavailable() {
  const { authError, logout, refreshUser } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="editorial-panel flex w-full max-w-md flex-col items-center rounded-[28px] border border-[var(--border-soft)] px-8 py-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-[rgba(176,69,55,0.1)] text-[var(--danger)]">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
          The study service is offline.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          {authError ??
            "We kept your session safe. Try reconnecting in a moment."}
        </p>
        <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
          <Button className="flex-1" onClick={() => void refreshUser()}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Button className="flex-1" variant="secondary" onClick={logout}>
            Sign in again
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  if (status === "unavailable") {
    return <AuthUnavailable />;
  }

  if (status !== "unauthenticated") {
    return <LoadingScreen message="Checking your account..." />;
  }

  return <>{children}</>;
}

export function ProtectedArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      const nextPath = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${nextPath}`);
    }
  }, [pathname, router, status]);

  if (status === "unavailable") {
    return <AuthUnavailable />;
  }

  if (status !== "authenticated") {
    return <LoadingScreen message="Opening your study dashboard..." />;
  }

  return <>{children}</>;
}
