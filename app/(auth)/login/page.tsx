"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/app/auth-shell";
import { OperationProgress } from "@/components/app/operation-progress";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError, ApiUnavailableError } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type LoginValues = z.infer<typeof loginSchema>;

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiUnavailableError) {
    return `${error.message} Your credentials were not rejected.`;
  }

  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "Login failed.";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticate } = useAuth();
  const nextPath = searchParams.get("next") || "/dashboard";

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginValues) => api.login(values),
    onSuccess: (payload) => {
      authenticate(payload);
      toast.success("Welcome back.");
      router.replace(nextPath);
    },
    onError: (error) => {
      toast.error(getLoginErrorMessage(error));
    },
  });

  const onSubmit = form.handleSubmit((values) => loginMutation.mutate(values));

  return (
    <AuthShell
      mode="login"
      title="Welcome back."
      description="Use the same backend-issued account you created for the study pipeline. Your documents, sessions, notes, and reviews stay tied to this account."
    >
      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              id="login-email"
              type="email"
              className="pl-11"
              placeholder="name@example.com"
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email ? (
            <p className="text-sm text-[var(--danger)]">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link
              href="/register"
              className="rounded-full bg-[rgba(253,218,178,0.55)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tertiary)] transition-colors hover:bg-[rgba(253,218,178,0.8)]"
            >
              New here?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              id="login-password"
              type="password"
              className="pl-11"
              placeholder="Enter your password"
              {...form.register("password")}
            />
          </div>
          {form.formState.errors.password ? (
            <p className="text-sm text-[var(--danger)]">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between py-1">
          <label className="flex items-center gap-3 text-sm text-[var(--foreground-soft)]">
            <input
              className="size-4 rounded-md border border-[var(--border-soft)] accent-[var(--primary)]"
              type="checkbox"
              defaultChecked
            />
            Remember me
          </label>
          <span className="text-xs text-[var(--muted-foreground)]">JWT access only</span>
        </div>

        {loginMutation.isError ? (
          <p
            className="rounded-2xl border border-[rgba(176,69,55,0.24)] bg-[rgba(176,69,55,0.08)] px-4 py-3 text-sm leading-6 text-[var(--danger)]"
            role="alert"
          >
            {getLoginErrorMessage(loginMutation.error)}
          </p>
        ) : null}

        {loginMutation.isPending ? (
          <OperationProgress compact label="Signing you in" detail="Checking your account and restoring the study workspace." />
        ) : null}

        <Button className="w-full" size="lg" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </Button>

        <p className="text-center text-sm text-[var(--foreground-soft)]">
          Need an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]"
          >
            Create one now
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
