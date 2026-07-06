"use client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Document, pdfjs } from "react-pdf";
import {
  BookOpenText,
  Bookmark,
  Expand,
  Eye,
  EyeOff,
  Highlighter,
  Lightbulb,
  Minimize2,
} from "lucide-react";

import type { ReaderSection } from "@/lib/document-reader";
import type { ReaderHighlightType, ReaderKeyTerm } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LazyPdfPage } from "@/components/app/lazy-pdf-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  cMapPacked: true,
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/wasm/`,
} as const;

type DocumentReaderProps = {
  blob: Blob | null;
  error: string | null;
  importantSentences: string[];
  isLoading: boolean;
  keyTerms: ReaderKeyTerm[];
  sections: ReaderSection[];
  title: string;
  initialPage?: number;
  onCurrentPageChange?: (page: number) => void;
};

export function DocumentReader({
  blob,
  error,
  importantSentences,
  isLoading,
  keyTerms,
  sections,
  title,
  initialPage = 1,
  onCurrentPageChange,
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
      <div className="fixed inset-0 z-50 bg-[rgba(28,27,27,0.45)] p-4 backdrop-blur-sm md:p-6">
        <div className="mx-auto h-full max-w-7xl">
          <ReaderSurface
            blob={blob}
            error={error}
            importantSentences={importantSentences}
            isFullscreen
            isLoading={isLoading}
            keyTerms={keyTerms}
            onToggleFullscreen={() => setIsFullscreen(false)}
            onToggleHighlights={() => setShowHighlights((value) => !value)}
            sections={sections}
            showHighlights={showHighlights}
            title={title}
            initialPage={initialPage}
            onCurrentPageChange={onCurrentPageChange}
          />
        </div>
      </div>
    );
  }

  return (
    <ReaderSurface
      blob={blob}
      error={error}
      importantSentences={importantSentences}
      isFullscreen={false}
      isLoading={isLoading}
      keyTerms={keyTerms}
      onToggleFullscreen={() => setIsFullscreen(true)}
      onToggleHighlights={() => setShowHighlights((value) => !value)}
      sections={sections}
      showHighlights={showHighlights}
      title={title}
      initialPage={initialPage}
      onCurrentPageChange={onCurrentPageChange}
    />
  );
}

function ReaderSurface({
  blob,
  error,
  importantSentences,
  isFullscreen,
  isLoading,
  keyTerms,
  onToggleFullscreen,
  onToggleHighlights,
  sections,
  showHighlights,
  title,
  initialPage = 1,
  onCurrentPageChange,
}: DocumentReaderProps & {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onToggleHighlights: () => void;
  showHighlights: boolean;
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(760);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const didResumeRef = useRef(false);
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  useEffect(() => {
    const node = viewerRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.max(
        320,
        Math.min(node.clientWidth - 48, isFullscreen ? 980 : 820),
      );
      setPageWidth(nextWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);

    return () => observer.disconnect();
  }, [isFullscreen]);

  useEffect(() => {
    if (!numPages || didResumeRef.current) {
      return;
    }

    const page = Math.max(1, Math.min(initialPage, numPages));
    const timeoutId = window.setTimeout(() => {
      const node = viewerRef.current;
      const target = node?.querySelector<HTMLElement>(`[data-reader-page="${page}"]`);
      if (node && target) {
        const targetTop = target.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop;
        node.scrollTo({ top: Math.max(0, targetTop - 16) });
      }
      onCurrentPageChange?.(page);
      didResumeRef.current = true;
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [initialPage, numPages, onCurrentPageChange]);

  useEffect(() => {
    const node = viewerRef.current;
    if (!node || !numPages || !onCurrentPageChange) {
      return;
    }

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.readerPage);
          ratios.set(page, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        const visible = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
        if (visible && visible[1] > 0) {
          onCurrentPageChange(visible[0]);
        }
      },
      { root: node, threshold: [0, 0.2, 0.45, 0.7] },
    );

    node
      .querySelectorAll<HTMLElement>("[data-reader-page]")
      .forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [numPages, onCurrentPageChange]);

  return (
    <Card className={isFullscreen ? "flex h-full flex-col overflow-hidden" : "overflow-hidden"}>
      <CardHeader className="border-b border-[var(--border-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              Read the original PDF with its visual structure intact, while the study guidance stays alongside it instead of flattening the document.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onToggleHighlights}>
              {showHighlights ? (
                <>
                  <EyeOff className="size-4" />
                  Hide guide
                </>
              ) : (
                <>
                  <Eye className="size-4" />
                  Show guide
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
      </CardHeader>
      <CardContent className={isFullscreen ? "flex-1 overflow-hidden p-0" : "p-0"}>
        {isLoading ? (
          <div className="flex h-[74vh] items-center justify-center bg-[var(--panel-soft)] text-[var(--muted-foreground)]">
            Preparing your reading view...
          </div>
        ) : error ? (
          <div className="flex h-[74vh] items-center justify-center bg-rose-500/10 px-6 text-center text-sm text-rose-100">
            {error}
          </div>
        ) : !blobUrl ? (
          <div className="flex h-[74vh] items-center justify-center bg-[var(--panel-soft)] px-6 text-center text-[var(--muted-foreground)]">
            The original PDF could not be loaded for this document.
          </div>
        ) : (
          <div className={isFullscreen ? "grid h-full lg:grid-cols-[minmax(0,1fr)_23rem]" : "grid min-h-[74vh] lg:grid-cols-[minmax(0,1fr)_23rem]"}>
            <div ref={viewerRef} className="overflow-y-auto bg-[linear-gradient(180deg,rgba(248,245,238,0.98),rgba(242,238,228,0.95))]">
              <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6">
                <div className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] px-5 py-4 shadow-[0_14px_35px_rgba(28,27,27,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                    Reader mode
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    This view keeps the PDF layout, hierarchy, footnotes, and visual rhythm intact so you are studying the actual document, not a flattened transcription.
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                    {numPages > 0 ? `${numPages} pages loaded` : "Loading pages"}
                  </p>
                </div>

                <Document
                  file={blobUrl}
                  loading={
                    <div className="rounded-[24px] border border-[var(--border-soft)] bg-white px-6 py-10 text-center text-[var(--muted-foreground)] shadow-[0_18px_40px_rgba(28,27,27,0.08)]">
                      Rendering PDF pages...
                    </div>
                  }
                  onLoadError={(loadError) => {
                    console.error("React-PDF failed to load document", loadError);
                  }}
                  onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
                  options={PDF_OPTIONS}
                  error={
                    <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-6 py-10 text-center text-sm text-rose-100">
                      The PDF renderer could not display this document.
                    </div>
                  }
                >
                  {Array.from({ length: numPages || 0 }, (_, index) => (
                    <div
                      key={`page-${index + 1}`}
                      data-reader-page={index + 1}
                      className={cn(
                        "scroll-mt-4 rounded-[26px] border bg-white p-3 shadow-[0_18px_40px_rgba(28,27,27,0.08)]",
                        initialPage === index + 1
                          ? "border-amber-400/70 ring-4 ring-amber-200/35"
                          : "border-[var(--border-soft)]",
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                        <span>Page {index + 1}</span>
                        {initialPage === index + 1 ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                            <Bookmark className="size-3.5 fill-current" />
                            Resume marker
                          </span>
                        ) : (
                          <span>{title}</span>
                        )}
                      </div>
                      <div className="overflow-hidden rounded-[18px] border border-[rgba(28,27,27,0.06)] bg-white">
                        <LazyPdfPage
                          eager={index + 1 === initialPage}
                          pageNumber={index + 1}
                          scrollRoot={viewerRef}
                          width={pageWidth}
                        />
                      </div>
                    </div>
                  ))}
                </Document>
              </div>
            </div>

            <aside className="overflow-y-auto border-t border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(250,248,242,0.92),rgba(243,239,229,0.94))] lg:border-l lg:border-t-0">
              <div className="space-y-4 px-4 py-5">
                <Card className="border-[rgba(194,200,190,0.42)] bg-[rgba(255,255,255,0.72)]">
                  <CardHeader>
                    <CardTitle className="text-lg">Reading guide</CardTitle>
                    <CardDescription>
                      Keep this visible while reading, or hide it when you want the PDF entirely on its own.
                    </CardDescription>
                  </CardHeader>
                </Card>

                {showHighlights ? (
                  <>
                    {importantSentences.length > 0 ? (
                      <GuideCard
                        description="The main line of thought to keep in mind while reading."
                        icon={<Highlighter className="size-4 text-[var(--primary)]" />}
                        title="Focus sentence"
                      >
                        <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                          {importantSentences[0]}
                        </p>
                      </GuideCard>
                    ) : null}

                    {sections.length > 0 ? (
                      <GuideCard
                        description="Contextual guidance that stays tied to the study purpose instead of trying to repaint the PDF text."
                        icon={<Lightbulb className="size-4 text-[var(--primary)]" />}
                        title="Section cues"
                      >
                        <div className="space-y-4">
                          {sections.map((section) => (
                            <div
                              key={`${section.id}-guide`}
                              className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4"
                            >
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                                {section.label}
                              </p>
                              <p className="mt-2 font-display text-xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
                                {section.title}
                              </p>
                              {section.highlights.length > 0 ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {uniqueHighlightTypes(section.highlights).map((type) => (
                                    <span key={`${section.id}-${type}`} className={highlightBadgeClass(type)}>
                                      {highlightLabel(type)}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              {section.summaryBullets.length > 0 ? (
                                <ul className="mt-4 space-y-2">
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
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </GuideCard>
                    ) : null}

                    {keyTerms.length > 0 ? (
                      <GuideCard
                        description="Definitions and high-signal concepts that are worth keeping precise."
                        icon={<BookOpenText className="size-4 text-[var(--primary)]" />}
                        title="Key terms"
                      >
                        <div className="space-y-3">
                          {keyTerms.map((item) => (
                            <div
                              key={item.term}
                              className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4"
                            >
                              <p className="font-display text-lg font-bold tracking-[-0.04em] text-[var(--foreground)]">
                                {item.term}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                                {item.definition}
                              </p>
                            </div>
                          ))}
                        </div>
                      </GuideCard>
                    ) : null}
                  </>
                ) : (
                  <Card className="border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)]">
                    <CardContent className="px-5 py-5 text-sm leading-7 text-[var(--muted-foreground)]">
                      Guidance is hidden right now, so you can read the PDF without any coaching layer in the way.
                    </CardContent>
                  </Card>
                )}
              </div>
            </aside>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GuideCard({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Card className="border-[rgba(194,200,190,0.42)] bg-[rgba(255,255,255,0.72)]">
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
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

function uniqueHighlightTypes(highlights: ReaderSection["highlights"]) {
  return Array.from(new Set(highlights.map((highlight) => highlight.type)));
}
