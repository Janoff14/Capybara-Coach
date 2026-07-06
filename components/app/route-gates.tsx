"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { LoadingScreen } from "@/components/app/loading-screen";
import { useAuth } from "@/components/providers/auth-provider";

function AuthUnavailable() {
  const { authError, logout, refreshUser } = useAuth();

  return (
    <div className="reader-catalog reader-unavailable-screen">
      <header className="reader-unavailable-masthead" aria-hidden="true">
        <strong>Capybara Coach</strong>
        <span>Reading room · service desk</span>
      </header>
      <main className="reader-unavailable-desk">
        <section className="reader-unavailable-card" role="alert" aria-live="assertive">
          <div className="reader-unavailable-stamp">Service paused</div>
          <AlertTriangle aria-hidden="true" />
          <p className="reader-overline">Circulation notice · connection required</p>
          <h1>
            The study service is offline.
          </h1>
          <p>{authError ?? "We kept your session safe. Try reconnecting in a moment."}</p>
          <div className="reader-unavailable-actions">
            <button type="button" className="is-primary" onClick={() => void refreshUser()}>
              <RefreshCw aria-hidden="true" />
              Try again
            </button>
            <button type="button" onClick={logout}>Sign in again</button>
          </div>
        </section>
      </main>
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
