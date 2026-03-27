"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingScreen } from "@/components/app/loading-screen";
import { useAuth } from "@/components/providers/auth-provider";

export default function HomePage() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }

    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  return <LoadingScreen message="Launching Capybara Coach..." />;
}
