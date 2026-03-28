"use client";

import { useEffect, useState } from "react";
import { Expand, Eye, EyeOff, Lightbulb, Minimize2 } from "lucide-react";

import {
  resolveSentenceHighlight,
  splitParagraphIntoSentences,
  type ReaderSection,
} from "@/lib/document-reader";
import type { ReaderHighlightType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DocumentReaderProps = {
  isLoading: boolean;
  title: string;
  sections: ReaderSection[];
};

export function DocumentReader({
  isLoading,
  title,
  sections,
}: DocumentReaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHighlights, setShowHighlights] = useState(true);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isFullscreen]);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[rgba(28,27,27,0.42)] p-4 backdrop-blur-sm md:p-6">
        <div className="mx-auto h-full max-w-6xl">
          <ReaderSurface
            title={title}
            sections={sections}
            isLoading={isLoading}
            isFullscreen
            showHighlights={showHighlights}
            onToggleFullscreen={() => setIsFullscreen(false)}
            onToggleHighlights={() => setShowHighlights((value) => !value)}
          />
        </div>
      </div>
    );
  }

  return (
    <ReaderSurface
      title={title}
      sections={sections}
      isLoading={isLoading}
      isFullscreen={false}
      showHighlights={showHighlights}
      onToggleFullscreen={() => setIsFullscreen(true)}
      onToggleHighlights={() => setShowHighlights((value) => !value)}
    />
  );
}

function ReaderSurface({
  isFullscreen,
  isLoading,
  onToggleFullscreen,
  onToggleHighlights,
  sections,
  showHighlights,
  title,
}: {
  isFullscreen: boolean;
  isLoading: boolean;
  onToggleFullscreen: () => void;
  onToggleHighlights: () => void;
  sections: ReaderSection[];
  showHighlights: boolean;
  title: string;
}) {
  return (
    <Card className={isFullscreen ? "flex h-full flex-col overflow-hidden" : "h-full"}>
      <CardHeader className="border-b border-[var(--border-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              Read in a cleaner study view with calmer spacing, stronger hierarchy, and fewer PDF-style distractions.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onToggleHighlights}>
              {showHighlights ? (
                <>
                  <EyeOff className="size-4" />
                  Hide highlights
                </>
              ) : (
                <>
                  <Eye className="size-4" />
                  Show highlights
                </>
              )}
            </Button>
            <Button variant="secondary" onClick={onToggleFullscreen}>
              {isFullscreen ? (
                <>
                  <Minimize2 className="size-4" />
                  Exit full screen
                </>
              ) : (
                <>
                  <Expand className="size-4" />
                  Full screen
                </>
              )}
            </Button>
          </div>
        </div>
        {showHighlights ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <LegendPill type="key_idea" label="Key idea" />
            <LegendPill type="definition" label="Definition" />
            <LegendPill type="example" label="Example" />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className={isFullscreen ? "flex-1 overflow-hidden p-0" : "p-0"}>
        {isLoading ? (
          <div className="flex h-[72vh] items-center justify-center rounded-b-[28px] bg-[var(--panel-soft)] text-[var(--muted-foreground)]">
            Preparing your reading view...
          </div>
        ) : sections.length === 0 ? (
          <div className="flex h-[72vh] items-center justify-center rounded-b-[28px] bg-[var(--panel-soft)] px-6 text-center text-[var(--muted-foreground)]">
            This upload does not have extracted text yet, so the reader cannot be rendered.
          </div>
        ) : (
          <div className="h-[72vh] overflow-y-auto bg-[linear-gradient(180deg,rgba(252,249,242,0.96),rgba(247,243,235,0.94))]">
            <div className="mx-auto flex max-w-3xl flex-col gap-14 px-6 py-8 md:px-10 md:py-10">
              {sections.map((section) => (
                <article key={section.id} className="space-y-6" id={section.id}>
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                      {section.label}
                    </p>
                    <h2 className="font-display text-[2rem] font-bold tracking-[-0.05em] text-[var(--foreground)] md:text-[2.35rem]">
                      {section.title}
                    </h2>
                  </div>

                  {showHighlights && section.highlights.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {section.highlights.map((highlight, index) => (
                        <span
                          key={`${section.id}-highlight-${index}`}
                          className={highlightBadgeClass(highlight.type)}
                        >
                          {highlightLabel(highlight.type)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-6">
                    {section.paragraphs.map((paragraph, index) => (
                      <p
                        key={`${section.id}-${index}`}
                        className="text-[1.02rem] leading-9 text-[rgba(52,52,47,0.92)] md:text-[1.08rem]"
                      >
                        {splitParagraphIntoSentences(paragraph).map((sentence, sentenceIndex, all) => {
                          const highlightType = showHighlights
                            ? resolveSentenceHighlight(sentence, section.highlights)
                            : null;

                          return (
                            <span
                              key={`${section.id}-${index}-${sentenceIndex}`}
                              className={highlightType ? highlightSentenceClass(highlightType) : undefined}
                            >
                              {sentence}
                              {sentenceIndex < all.length - 1 ? " " : ""}
                            </span>
                          );
                        })}
                      </p>
                    ))}
                  </div>

                  {section.summaryBullets.length > 0 ? (
                    <div className="rounded-[22px] border border-[rgba(194,200,190,0.42)] bg-[rgba(133,165,121,0.08)] p-5">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="size-4 text-[var(--primary)]" />
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                          Section summary
                        </p>
                      </div>
                      <ul className="mt-4 space-y-3">
                        {section.summaryBullets.map((item) => (
                          <li
                            key={`${section.id}-summary-${item.slice(0, 32)}`}
                            className="flex items-start gap-3 text-sm leading-7 text-[var(--muted-foreground)]"
                          >
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LegendPill({
  label,
  type,
}: {
  label: string;
  type: ReaderHighlightType;
}) {
  return <span className={highlightBadgeClass(type)}>{label}</span>;
}

function highlightLabel(type: ReaderHighlightType) {
  if (type === "definition") {
    return "Definition";
  }

  if (type === "example") {
    return "Example";
  }

  return "Key idea";
}

function highlightBadgeClass(type: ReaderHighlightType) {
  const shared =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]";

  if (type === "definition") {
    return `${shared} border-sky-300/55 bg-sky-400/12 text-sky-800`;
  }

  if (type === "example") {
    return `${shared} border-emerald-300/55 bg-emerald-400/12 text-emerald-800`;
  }

  return `${shared} border-amber-300/60 bg-amber-300/18 text-amber-900`;
}

function highlightSentenceClass(type: ReaderHighlightType) {
  const shared =
    "rounded-md px-1.5 py-0.5 transition-colors";

  if (type === "definition") {
    return `${shared} bg-sky-200/65 text-slate-900`;
  }

  if (type === "example") {
    return `${shared} bg-emerald-200/65 text-slate-900`;
  }

  return `${shared} bg-amber-200/70 text-slate-900`;
}
