"use client";

import { useEffect, useState } from "react";
import { Expand, Minimize2 } from "lucide-react";

import type { ReaderSection } from "@/lib/document-reader";
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
            onToggleFullscreen={() => setIsFullscreen(false)}
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
      onToggleFullscreen={() => setIsFullscreen(true)}
    />
  );
}

function ReaderSurface({
  isFullscreen,
  isLoading,
  onToggleFullscreen,
  sections,
  title,
}: {
  isFullscreen: boolean;
  isLoading: boolean;
  onToggleFullscreen: () => void;
  sections: ReaderSection[];
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

                  <div className="space-y-6">
                    {section.paragraphs.map((paragraph, index) => (
                      <p
                        key={`${section.id}-${index}`}
                        className="text-[1.02rem] leading-9 text-[rgba(52,52,47,0.92)] md:text-[1.08rem]"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
