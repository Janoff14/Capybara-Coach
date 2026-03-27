"use client";

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
      title="Create a study account and start the recall loop."
      description="This is a lightweight MVP account. No email verification, no OAuth, just enough to keep sessions, documents, and notes tied to you."
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="register-name">Display name</Label>
          <Input id="register-name" {...form.register("display_name")} />
          {form.formState.errors.display_name ? (
            <p className="text-sm text-rose-300">
              {form.formState.errors.display_name.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input id="register-email" type="email" {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-rose-300">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            type="password"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-sm text-rose-300">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>

        <Button
          className="w-full"
          size="lg"
          type="submit"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
