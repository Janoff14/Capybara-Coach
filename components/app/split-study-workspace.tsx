"use client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document as PdfDocument, Page, pdfjs } from "react-pdf";
import {
  Bookmark,
  BookOpenText,
  Brain,
  Clock3,
  MessageSquareText,
  NotebookPen,
  Pause,
  Play,
  Send,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TypedCaptureChunk, TypedChunkCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  cMapPacked: true,
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
  wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/wasm/`,
} as const;

const CATEGORY_OPTIONS: Array<{
  value: TypedChunkCategory;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Brain;
  activeClass: string;
  bubbleClass: string;
}> = [
  {
    value: "study_material",
    label: "Study material",
    shortLabel: "Cards + note",
    description: "Use this in the polished note and flashcard deck.",
    icon: Brain,
    activeClass: "border-emerald-300 bg-emerald-100 text-emerald-900",
    bubbleClass: "border-emerald-200 bg-emerald-50/90",
  },
  {
    value: "note_only",
    label: "Note only",
    shortLabel: "Note only",
    description: "Keep this in your note, but never turn it into a card.",
    icon: NotebookPen,
    activeClass: "border-sky-300 bg-sky-100 text-sky-900",
    bubbleClass: "border-sky-200 bg-sky-50/90",
  },
  {
    value: "ai_direction",
    label: "AI direction",
    shortLabel: "Instruction",
    description: "Tell the AI how to organize or emphasize the final result.",
    icon: Sparkles,
    activeClass: "border-amber-300 bg-amber-100 text-amber-950",
    bubbleClass: "border-amber-200 bg-amber-50/90",
  },
];

type SplitStudyWorkspaceProps = {
  blob: Blob | null;
  chunks: TypedCaptureChunk[];
  currentPage: number;
  elapsed: string;
  error: string | null;
  initialPage: number;
  isFinishing: boolean;
  isLoading: boolean;
  isMarking: boolean;
  isSaving: boolean;
  markedPage: number;
  onCategoryChange: (chunkId: string, category: TypedChunkCategory) => Promise<void>;
  onCurrentPageChange: (page: number) => void;
  onFinish: () => void;
  onMarkPage: () => void;
  onSubmit: (content: string, category: TypedChunkCategory) => Promise<boolean>;
  processingStage: string | null;
  title: string;
};

export function SplitStudyWorkspace({
  blob,
  chunks,
  currentPage,
  elapsed,
  error,
  initialPage,
  isFinishing,
  isLoading,
  isMarking,
  isSaving,
  markedPage,
  onCategoryChange,
  onCurrentPageChange,
  onFinish,
  onMarkPage,
  onSubmit,
  processingStage,
  title,
}: SplitStudyWorkspaceProps) {
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<TypedChunkCategory>("study_material");
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(760);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(12);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const didResumeRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  const hasProcessableChunks = chunks.some(
    (chunk) => chunk.category === "study_material" || chunk.category === "note_only",
  );

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
      setPageWidth(Math.max(300, Math.min(node.clientWidth - 40, 900)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!numPages || didResumeRef.current) {
      return;
    }

    const page = Math.max(1, Math.min(initialPage || 1, numPages));
    const timeoutId = window.setTimeout(() => {
      const node = viewerRef.current;
      const target = node?.querySelector<HTMLElement>(`[data-pdf-page="${page}"]`);
      if (node && target) {
        const targetTop = target.getBoundingClientRect().top - node.getBoundingClientRect().top + node.scrollTop;
        node.scrollTo({ top: Math.max(0, targetTop - 16) });
      }
      onCurrentPageChange(page);
      didResumeRef.current = true;
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [initialPage, numPages, onCurrentPageChange]);

  useEffect(() => {
    const node = viewerRef.current;
    if (!node || !numPages) {
      return;
    }

    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.pdfPage);
          ratios.set(page, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        const visible = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
        if (visible && visible[1] > 0) {
          onCurrentPageChange(visible[0]);
        }
      },
      { root: node, threshold: [0, 0.2, 0.45, 0.7] },
    );

    node.querySelectorAll<HTMLElement>("[data-pdf-page]").forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [numPages, onCurrentPageChange]);

  useEffect(() => {
    if (!autoScroll) {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      lastFrameAtRef.current = null;
      return;
    }

    const tick = (time: number) => {
      const node = viewerRef.current;
      if (!node) {
        setAutoScroll(false);
        return;
      }

      const previous = lastFrameAtRef.current ?? time;
      const deltaSeconds = Math.min(0.05, (time - previous) / 1000);
      lastFrameAtRef.current = time;
      node.scrollTop += scrollSpeed * deltaSeconds;

      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 2) {
        setAutoScroll(false);
        return;
      }
      scrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    scrollFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, [autoScroll, scrollSpeed]);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [chunks.length]);

  const submitDraft = async () => {
    const content = draft.trim();
    if (!content || isFinishing) {
      return;
    }

    setDraft("");
    textareaRef.current?.focus();
    const saved = await onSubmit(content, category);
    if (!saved) {
      setDraft((current) => current || content);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitDraft();
    }
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-white/80 shadow-[var(--shadow-panel)] xl:h-[calc(100vh-7.5rem)] xl:min-h-[700px]">
      <div className="grid h-full xl:grid-cols-[minmax(0,1.78fr)_minmax(360px,1fr)]">
        <section className="flex min-h-[70vh] min-w-0 flex-col bg-[linear-gradient(180deg,#eeece5,#e7e4db)] xl:min-h-0">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-black/8 bg-white/82 px-5 py-4 backdrop-blur-xl">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-[var(--primary)]">
                <BookOpenText className="size-4" />
                Textbook
              </p>
              <h1 className="mt-1 truncate font-display text-xl font-bold tracking-[-0.035em] text-[var(--foreground)]">
                {title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-soft)]">
                Page {currentPage || 1}{numPages ? ` of ${numPages}` : ""}
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onMarkPage}
                disabled={!blobUrl || Boolean(error) || isMarking}
                aria-label={`Mark page ${currentPage || 1} as the resume point`}
              >
                <Bookmark
                  className={cn(
                    "size-4",
                    markedPage === currentPage && "fill-current",
                  )}
                />
                {isMarking
                  ? "Marking..."
                  : markedPage === currentPage
                    ? "Page marked"
                    : "Mark this page"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setAutoScroll((value) => !value)}
                disabled={!blobUrl || Boolean(error)}
                aria-pressed={autoScroll}
              >
                {autoScroll ? <Pause className="size-4" /> : <Play className="size-4" />}
                {autoScroll ? "Pause" : "Auto-scroll"}
              </Button>
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)]">
                <span className="sr-only">Auto-scroll speed</span>
                <input
                  type="range"
                  min={4}
                  max={36}
                  step={1}
                  value={scrollSpeed}
                  onChange={(event) => setScrollSpeed(Number(event.target.value))}
                  className="h-2 w-24 cursor-pointer accent-[var(--primary)]"
                />
                <span className="w-10 tabular-nums">{scrollSpeed}px/s</span>
              </label>
            </div>
          </header>

          <div
            ref={viewerRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 py-5"
            aria-label="Scrollable textbook pages"
          >
            {isLoading ? (
              <ReaderMessage>Preparing the textbook...</ReaderMessage>
            ) : error ? (
              <ReaderMessage tone="error">{error}</ReaderMessage>
            ) : !blobUrl ? (
              <ReaderMessage>No PDF preview is available.</ReaderMessage>
            ) : (
              <PdfDocument
                file={blobUrl}
                options={PDF_OPTIONS}
                onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
                loading={<ReaderMessage>Rendering pages...</ReaderMessage>}
                error={<ReaderMessage tone="error">The PDF could not be rendered.</ReaderMessage>}
              >
                <div className="mx-auto flex max-w-[940px] flex-col gap-6">
                  {Array.from({ length: numPages }, (_, index) => {
                    const page = index + 1;
                    const isResumePage = markedPage > 0 && page === markedPage;
                    return (
                      <article
                        key={page}
                        data-pdf-page={page}
                        className={cn(
                          "relative scroll-mt-4 rounded-[24px] border bg-white p-3 shadow-[0_18px_42px_rgba(28,27,27,0.10)]",
                          isResumePage ? "border-amber-400/70 ring-4 ring-amber-200/35" : "border-black/8",
                        )}
                      >
                        <div className="mb-3 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
                          <span>Page {page}</span>
                          {isResumePage ? (
                            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                              <Bookmark className="size-3.5 fill-current" />
                              Saved marker
                            </span>
                          ) : null}
                        </div>
                        <div className="overflow-hidden rounded-[16px] border border-black/6 bg-white">
                          <Page
                            pageNumber={page}
                            width={pageWidth}
                            renderAnnotationLayer
                            renderTextLayer
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </PdfDocument>
            )}
          </div>
        </section>

        <section className="flex min-h-[720px] min-w-0 flex-col border-t border-[var(--border-soft)] bg-[#fbfaf6] xl:min-h-0 xl:border-l xl:border-t-0">
          <header className="border-b border-[var(--border-soft)] bg-white/88 px-5 py-4 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.17em] text-[var(--primary)]">
                  <MessageSquareText className="size-4" />
                  Capture stream
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                  Send one thought at a time. You can change its role before processing.
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-3 py-2 text-right">
                <p className="flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  <Clock3 className="size-3.5" /> Time
                </p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--foreground)]">{elapsed}</p>
              </div>
            </div>

            <Button
              type="button"
              className="mt-4 w-full"
              onClick={onFinish}
              disabled={!hasProcessableChunks || isFinishing || isSaving}
            >
              <Sparkles className={cn("size-4", isFinishing && "animate-pulse")} />
              {processingStage ?? (isFinishing ? "Processing session..." : "End session & create study set")}
            </Button>
            {!hasProcessableChunks ? (
              <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">
                Add at least one study-material or note-only chunk to finish.
              </p>
            ) : null}
          </header>

          <div ref={timelineRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-5">
            {chunks.length === 0 ? (
              <div className="flex h-full min-h-52 flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--border-soft)] bg-white/55 px-6 text-center">
                <MessageSquareText className="size-7 text-[var(--primary)]" />
                <p className="mt-3 font-semibold text-[var(--foreground)]">Your reading trail starts here</p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted-foreground)]">
                  Capture facts, private notes, or directions for the AI without leaving the page.
                </p>
              </div>
            ) : (
              chunks.map((chunk, index) => {
                const option = CATEGORY_OPTIONS.find((item) => item.value === chunk.category)!;
                const Icon = option.icon;
                return (
                  <article key={chunk.id} className={cn("rounded-[20px] border p-4 transition-colors", option.bubbleClass)}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--foreground-soft)]">
                        <Icon className="size-3.5" />
                        {option.label}
                      </p>
                      <span className="text-[10px] tabular-nums text-[var(--muted-foreground)]">#{index + 1}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--foreground)]">{chunk.content}</p>
                    <div className="mt-4 flex items-center gap-1 rounded-xl bg-white/62 p-1" aria-label={`Change category for chunk ${index + 1}`}>
                      {CATEGORY_OPTIONS.map((categoryOption) => {
                        const CategoryIcon = categoryOption.icon;
                        const selected = categoryOption.value === chunk.category;
                        return (
                          <button
                            key={categoryOption.value}
                            type="button"
                            onClick={() => void onCategoryChange(chunk.id, categoryOption.value)}
                            disabled={isFinishing}
                            aria-label={`Mark as ${categoryOption.label}`}
                            aria-pressed={selected}
                            title={categoryOption.label}
                            className={cn(
                              "flex h-8 flex-1 items-center justify-center rounded-lg border border-transparent transition disabled:opacity-50",
                              selected ? categoryOption.activeClass : "text-[var(--muted-foreground)] hover:bg-white",
                            )}
                          >
                            <CategoryIcon className="size-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <footer className="border-t border-[var(--border-soft)] bg-white/92 p-4 backdrop-blur-xl">
            <CategorySelector value={category} onChange={setCategory} disabled={isFinishing} />
            <div className="mt-3 flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                maxLength={4000}
                rows={3}
                disabled={isFinishing}
                placeholder="Type a thought… Enter to send, Shift+Enter for a new line"
                className="min-h-24 resize-none bg-[#f7f6f1]"
                aria-label="Capture a reading thought"
              />
              <Button
                type="button"
                size="icon"
                onClick={() => void submitDraft()}
                disabled={!draft.trim() || isFinishing}
                aria-label="Save chunk"
              >
                <Send className="size-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[var(--muted-foreground)]">
              <span>{CATEGORY_OPTIONS.find((item) => item.value === category)?.description}</span>
              <span className="flex shrink-0 items-center gap-2 tabular-nums">
                <span aria-live="polite">{isSaving ? "Syncing..." : "Saved"}</span>
                <span>{draft.length}/4000</span>
              </span>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}

function CategorySelector({
  value,
  onChange,
  disabled,
}: {
  value: TypedChunkCategory;
  onChange: (value: TypedChunkCategory) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-[16px] border border-[var(--border-soft)] bg-[var(--panel-soft)] p-1" aria-label="Chunk category">
      {CATEGORY_OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-xl border border-transparent px-2 py-2 text-center transition disabled:opacity-50",
              selected ? option.activeClass : "text-[var(--muted-foreground)] hover:bg-white/80",
            )}
          >
            <Icon className="size-4" />
            <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em]">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ReaderMessage({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "error" }) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-52 max-w-xl items-center justify-center rounded-[24px] border border-dashed bg-white/75 px-6 text-center text-sm",
        tone === "error" ? "border-rose-300 text-rose-800" : "border-black/10 text-[var(--muted-foreground)]",
      )}
    >
      {children}
    </div>
  );
}
