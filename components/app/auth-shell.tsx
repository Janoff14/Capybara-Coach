import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  title,
  description,
  mode,
  children,
}: {
  title: string;
  description: string;
  mode: "login" | "register";
  children: React.ReactNode;
}) {
  const isLogin = mode === "login";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(133,165,121,0.14),transparent_28%),radial-gradient(circle_at_top_center,rgba(245,212,140,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(133,165,121,0.08),transparent_28%)]" />
      <Card className="relative w-full max-w-lg rounded-[24px]">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Capybara Coach
          </p>
          <CardTitle className="text-3xl">{title}</CardTitle>
          <CardDescription className="max-w-md">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
          <p className="text-sm text-[var(--muted-foreground)]">
            {isLogin ? "Need an account?" : "Already have an account?"}{" "}
            <Link
              href={isLogin ? "/register" : "/login"}
              className="font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              {isLogin ? "Create one now" : "Sign in instead"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
