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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_32%)]" />
      <Card className="relative w-full max-w-lg">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            Capybara Coach
          </p>
          <CardTitle className="text-3xl">{title}</CardTitle>
          <CardDescription className="max-w-md">{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
          <p className="text-sm text-slate-300">
            {isLogin ? "Need an account?" : "Already have an account?"}{" "}
            <Link
              href={isLogin ? "/register" : "/login"}
              className="font-semibold text-cyan-300 hover:text-cyan-200"
            >
              {isLogin ? "Create one now" : "Sign in instead"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
