"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { AuthShell } from "@/components/app/auth-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type LoginValues = z.infer<typeof loginSchema>;

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
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Login failed.";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit((values) => loginMutation.mutate(values));

  return (
    <AuthShell
      mode="login"
      title="Sign in and pick up your next recall session."
      description="Use the same backend-issued account you created for the study pipeline. We keep auth simple for the MVP."
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-rose-300">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link href="/register" className="text-xs text-slate-400 hover:text-white">
              New here?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-sm text-rose-300">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <Button className="w-full" size="lg" type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
