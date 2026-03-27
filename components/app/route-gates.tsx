"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/app/loading-screen";
import { useAuth } from "@/components/providers/auth-provider";

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

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

  if (status !== "authenticated") {
    return <LoadingScreen message="Opening your study dashboard..." />;
  }

  return <>{children}</>;
}
