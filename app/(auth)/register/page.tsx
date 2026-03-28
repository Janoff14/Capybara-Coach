"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, Mail, User } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/app/auth-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

const registerSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters.")
    .max(255, "Display name is too long."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticate } = useAuth();
  const nextPath = searchParams.get("next") || "/dashboard";

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      display_name: "",
      email: "",
      password: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: (values: RegisterValues) => api.register(values),
    onSuccess: (payload) => {
      authenticate(payload);
      toast.success("Account created.");
      router.replace(nextPath);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Registration failed.";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit((values) =>
    registerMutation.mutate(values),
  );

  return (
    <AuthShell
      mode="register"
      title="Create your study account."
      description="This is still a lightweight MVP account. No OAuth, no email verification, just enough to keep your study material, sessions, notes, and review history attached to you."
    >
      <form className="space-y-6" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="register-name">Display name</Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              id="register-name"
              className="pl-11"
              placeholder="Alex Rivier"
              {...form.register("display_name")}
            />
          </div>
          {form.formState.errors.display_name ? (
            <p className="text-sm text-[var(--danger)]">
              {form.formState.errors.display_name.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              id="register-email"
              type="email"
              className="pl-11"
              placeholder="name@capybaracoach.app"
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
          <Label htmlFor="register-password">Password</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              id="register-password"
              type="password"
              className="pl-11"
              placeholder="At least 8 characters"
              {...form.register("password")}
            />
          </div>
          {form.formState.errors.password ? (
            <p className="text-sm text-[var(--danger)]">
              {form.formState.errors.password.message}
            </p>
          ) : null}
          <p className="text-xs leading-6 text-[var(--muted-foreground)]">
            Keep it simple for now. We can harden password policy after the MVP loop is stable.
          </p>
        </div>

        <Button
          className="w-full"
          size="lg"
          type="submit"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? "Creating account..." : "Create account"}
        </Button>

        <p className="text-center text-sm text-[var(--foreground-soft)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--primary)] hover:text-[var(--primary-strong)]"
          >
            Sign in instead
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
