import { Spinner } from "@/components/ui/spinner";

export function LoadingScreen({
  message = "Loading your study workspace...",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="glass-panel flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-white/10 px-8 py-10 text-center">
        <Spinner className="size-8 text-cyan-300" />
        <div>
          <p className="font-display text-xl font-semibold text-white">{message}</p>
          <p className="mt-2 text-sm text-slate-300">
            Hang tight while we sync your current session.
          </p>
        </div>
      </div>
    </div>
  );
}
