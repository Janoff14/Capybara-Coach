import { Spinner } from "@/components/ui/spinner";

export function LoadingScreen({
  message = "Loading your study workspace...",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-panel flex w-full max-w-md flex-col items-center gap-4 rounded-[24px] border border-[var(--border-soft)] px-8 py-10 text-center">
        <Spinner className="size-8 text-[var(--primary)]" />
        <div>
          <p className="font-display text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]">{message}</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Hang tight while we sync your current session.
          </p>
        </div>
      </div>
    </div>
  );
}
