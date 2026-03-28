"use client";

import { Brain, CheckCircle2, FileLock2, Lightbulb, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecallPrompt } from "@/lib/recall";

type RecallSessionPanelProps = {
  checklist: string[];
  documentTitle: string;
  pageCount: number | null;
  prompts: RecallPrompt[];
};

export function RecallSessionPanel({
  checklist,
  documentTitle,
  pageCount,
  prompts,
}: RecallSessionPanelProps) {
  return (
    <div className="space-y-5">
      <Card className="border-[rgba(73,102,64,0.16)] bg-[linear-gradient(180deg,rgba(73,102,64,0.08),rgba(255,255,255,0.82))]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-[var(--primary)]" />
            <CardTitle>Recall mode is live</CardTitle>
          </div>
          <CardDescription>
            The source stays hidden on purpose, so this stage measures memory and explanation instead of rereading.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-7 text-[var(--muted-foreground)]">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4">
            <div className="flex items-center gap-2 text-[var(--foreground)]">
              <FileLock2 className="size-4 text-[var(--primary)]" />
              <span className="font-semibold">Source hidden</span>
            </div>
            <p className="mt-2">
              {documentTitle} is out of view while you speak. Trust retrieval first, then tighten the explanation as you go.
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              {pageCount ? `${pageCount} page reference you just studied` : "Study reference loaded"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-[var(--primary)]" />
            <CardTitle>Recall prompts</CardTitle>
          </div>
          <CardDescription>
            Use these as anchors if you need structure, but keep the explanation sounding natural.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                {prompt.label}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                {prompt.prompt}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--primary)]" />
            <CardTitle>What good recall sounds like</CardTitle>
          </div>
          <CardDescription>
            Keep the explanation lean and deliberate instead of trying to sound exhaustive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklist.map((item) => (
            <div key={item} className="flex items-start gap-3 text-sm leading-7 text-[var(--muted-foreground)]">
              <CheckCircle2 className="mt-1 size-4 shrink-0 text-[var(--primary)]" />
              <p>{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
