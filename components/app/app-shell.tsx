"use client";

import { usePathname, useRouter } from "next/navigation";

import { ReaderCatalogShell } from "@/components/app/reader-catalog-shell";
import { useAuth } from "@/components/providers/auth-provider";

function activeTab(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "/dashboard";
  if (pathname.startsWith("/documents")) return "/documents";
  if (pathname.startsWith("/practice")) return "/practice";
  if (pathname.startsWith("/notes")) return "/notes";
  return "/capture";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const isCaptureWorkspace = pathname.includes("/study/") && pathname.endsWith("/capture");

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <ReaderCatalogShell
      activeHref={activeTab(pathname)}
      displayName={user?.display_name}
      fullBleed={pathname === "/capture" || isCaptureWorkspace}
      onLogout={handleLogout}
    >
      {children}
    </ReaderCatalogShell>
  );
}
