"use client";

import { cn } from "@/lib/utils";

type CoachState = "idle" | "listening" | "thinking" | "hint" | "encouraging";

const STATE_LABELS: Record<CoachState, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  hint: "Giving hint",
  encouraging: "Encouraging",
};

const PROMPT_TYPE_LABELS = {
  recall: "Recall",
  depth: "Depth",
  connection: "Connection",
} as const;

export function CapybaraCoach({
  message,
  promptType,
  state,
}: {
  message: string;
  promptType?: "recall" | "depth" | "connection" | null;
  state: CoachState;
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex max-w-[calc(100vw-2rem)] items-end gap-3 md:bottom-6 md:right-6">
      <div className="max-w-72 rounded-[24px] border border-[rgba(229,226,225,0.92)] bg-[rgba(255,255,255,0.92)] px-4 py-3 shadow-[0_18px_40px_rgba(28,27,27,0.12)] backdrop-blur-md">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          <span>{STATE_LABELS[state]}</span>
          {promptType ? (
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--panel-soft)] px-2 py-0.5 text-[10px] text-[var(--primary)]">
              {PROMPT_TYPE_LABELS[promptType]}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{message}</p>
      </div>

      <div className="relative h-20 w-20 shrink-0">
        <div className="absolute left-3 top-0 h-5 w-5 rounded-full border border-[rgba(91,70,48,0.2)] bg-[linear-gradient(180deg,#b28a63,#8b6948)]" />
        <div className="absolute right-3 top-0 h-5 w-5 rounded-full border border-[rgba(91,70,48,0.2)] bg-[linear-gradient(180deg,#b28a63,#8b6948)]" />
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 h-[4.5rem] rounded-full border shadow-[0_18px_36px_rgba(28,27,27,0.14)]",
            state === "hint" && "border-amber-300/70 bg-[linear-gradient(180deg,#c89d72,#9b744e)]",
            state === "thinking" && "border-sky-300/70 bg-[linear-gradient(180deg,#c49b72,#8b6a49)]",
            state === "encouraging" && "border-emerald-300/70 bg-[linear-gradient(180deg,#cba77e,#957250)]",
            (state === "idle" || state === "listening") &&
              "border-[rgba(91,70,48,0.24)] bg-[linear-gradient(180deg,#c19a72,#8d6a49)]",
          )}
        >
          <div className="absolute left-5 top-7 h-2.5 w-2.5 rounded-full bg-[#2d241d]" />
          <div className="absolute right-5 top-7 h-2.5 w-2.5 rounded-full bg-[#2d241d]" />
          <div className="absolute left-1/2 top-9 h-4 w-7 -translate-x-1/2 rounded-full bg-[#f2dfc4]" />
          <div className="absolute left-1/2 top-[2.55rem] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#2d241d]" />
        </div>
      </div>
    </div>
  );
}
