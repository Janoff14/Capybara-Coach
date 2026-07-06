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
import Link from "next/link";
import { Document as PdfDocument, pdfjs } from "react-pdf";
import {
  Bookmark,
  BookOpenText,
  Brain,
  MessageSquareText,
  NotebookPen,
  Pause,
  Play,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import type { TypedCaptureChunk, TypedChunkCategory } from "@/lib/types";
import { LazyPdfPage } from "@/components/app/lazy-pdf-page";
import { OperationProgress } from "@/components/app/operation-progress";

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
  sub: string;
  description: string;
  icon: typeof Brain;
  tone: "study" | "note" | "ai";
}> = [
  {
    value: "study_material",
    label: "Study material",
    sub: "→ flashcard",
    description: "Facts to become flashcards",
    icon: Brain,
    tone: "study",
  },
  {
    value: "note_only",
    label: "Note only",
    sub: "→ note",
    description: "Kept as a note, not a card",
    icon: NotebookPen,
    tone: "note",
  },
  {
    value: "ai_direction",
    label: "AI direction",
    sub: "instruction",
    description: "A private instruction for the AI",
    icon: Sparkles,
    tone: "ai",
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
  onRemove: (chunkId: string) => Promise<void>;
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
  onRemove,
  onSubmit,
  processingStage,
  title,
}: SplitStudyWorkspaceProps) {
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState<TypedChunkCategory>("study_material");
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(12);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const didResumeRef = useRef(false);
  const scrollFrameRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number | null>(null);
  const blobUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  const counts = useMemo(
    () => ({
      study: chunks.filter((chunk) => chunk.category === "study_material").length,
      note: chunks.filter((chunk) => chunk.category === "note_only").length,
      ai: chunks.filter((chunk) => chunk.category === "ai_direction").length,
    }),
    [chunks],
  );
  const hasProcessableChunks = counts.study + counts.note > 0;
  const progress = numPages ? Math.min(100, Math.round((currentPage / numPages) * 100)) : 0;
  const activeOption = CATEGORY_OPTIONS.find((option) => option.value === category)!;

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    const node = viewerRef.current;
    if (!node) return;
    const updateWidth = () => setPageWidth(Math.max(280, Math.min(node.clientWidth - 68, 900)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!numPages || didResumeRef.current) return;
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
    if (!node || !numPages) return;
    const ratios = new Map<number, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const page = Number((entry.target as HTMLElement).dataset.pdfPage);
          if (entry.isIntersecting) ratios.set(page, entry.intersectionRatio);
          else ratios.delete(page);
        });
        let visible: [number, number] | undefined;
        ratios.forEach((ratio, page) => {
          if (!visible || ratio > visible[1]) visible = [page, ratio];
        });
        if (visible && visible[1] > 0) onCurrentPageChange(visible[0]);
      },
      { root: node, threshold: [0, 0.2, 0.45, 0.7] },
    );
    node.querySelectorAll<HTMLElement>("[data-pdf-page]").forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [numPages, onCurrentPageChange]);

  useEffect(() => {
    if (!autoScroll) {
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
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
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [autoScroll, scrollSpeed]);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: "smooth" });
  }, [chunks.length]);

  const submitDraft = async () => {
    const content = draft.trim();
    if (!content || isFinishing) return;
    setDraft("");
    textareaRef.current?.focus();
    const saved = await onSubmit(content, category);
    if (!saved) setDraft((current) => current || content);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitDraft();
    }
  };

  const cycleCategory = (chunk: TypedCaptureChunk) => {
    const currentIndex = CATEGORY_OPTIONS.findIndex((option) => option.value === chunk.category);
    const next = CATEGORY_OPTIONS[(currentIndex + 1) % CATEGORY_OPTIONS.length];
    void onCategoryChange(chunk.id, next.value);
  };

  return (
    <div className="reader-workspace">
      <section className="reader-pdf-pane">
        <header className="reader-pdf-toolbar">
          <div className="reader-pdf-title-row">
            <div className="reader-pdf-title">
              <Link href="/capture" className="reader-shelf-link">‹ Shelf</Link>
              <div>
                <h1>{title}</h1>
                <p><BookOpenText aria-hidden="true" /> Shelf · {numPages || "—"} pp. · Page {currentPage || 1} of {numPages || "—"}</p>
              </div>
            </div>
            <button
              type="button"
              className={markedPage === currentPage ? "reader-mark-button is-marked" : "reader-mark-button"}
              onClick={onMarkPage}
              disabled={!blobUrl || Boolean(error)}
            >
              <Bookmark aria-hidden="true" />
              {isMarking ? "Marked · syncing" : markedPage === currentPage ? "Spot marked" : "Mark my spot"}
            </button>
          </div>

          <div className="reader-scroll-controls">
            <button
              type="button"
              className={autoScroll ? "reader-auto-button is-active" : "reader-auto-button"}
              onClick={() => setAutoScroll((value) => !value)}
              disabled={!blobUrl || Boolean(error)}
              aria-pressed={autoScroll}
            >
              {autoScroll ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {autoScroll ? "Pause auto-scroll" : "Auto-scroll"}
            </button>
            <label>
              <span>Slow</span>
              <input
                type="range"
                min={4}
                max={36}
                step={1}
                value={scrollSpeed}
                onChange={(event) => setScrollSpeed(Number(event.target.value))}
                aria-label="Auto-scroll speed"
              />
              <span>Fast</span>
              <strong>×{Math.max(1, Math.round(scrollSpeed / 4))}</strong>
            </label>
          </div>
          <div className="reader-page-progress"><i style={{ width: `${progress}%` }} /></div>
        </header>

        <div ref={viewerRef} className="reader-pdf-scroll" aria-label="Scrollable textbook pages">
          {isLoading ? (
            <ReaderMessage>Preparing the textbook…</ReaderMessage>
          ) : error ? (
            <ReaderMessage tone="error">{error}</ReaderMessage>
          ) : !blobUrl ? (
            <ReaderMessage>No PDF preview is available.</ReaderMessage>
          ) : (
            <PdfDocument
              file={blobUrl}
              options={PDF_OPTIONS}
              onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
              loading={<ReaderMessage>Rendering pages…</ReaderMessage>}
              error={<ReaderMessage tone="error">The PDF could not be rendered.</ReaderMessage>}
            >
              <div className="reader-pdf-pages">
                {Array.from({ length: numPages }, (_, index) => {
                  const page = index + 1;
                  const isResumePage = markedPage > 0 && page === markedPage;
                  return (
                    <article key={page} data-pdf-page={page} className="reader-pdf-page">
                      {isResumePage ? <span className="reader-page-ribbon" title="Saved marker" /> : null}
                      <div className="reader-pdf-page-label">
                        <span>Page {page}</span>
                        {isResumePage ? <strong><Bookmark aria-hidden="true" /> Saved marker</strong> : null}
                      </div>
                      <div className="reader-pdf-canvas">
                        {pageWidth > 0 ? (
                          <LazyPdfPage
                            eager={page === initialPage}
                            pageNumber={page}
                            renderInteractiveLayers={false}
                            scrollRoot={viewerRef}
                            width={pageWidth}
                          />
                        ) : null}
                      </div>
                      <p className="reader-page-number">— {page} —</p>
                    </article>
                  );
                })}
              </div>
            </PdfDocument>
          )}
        </div>
      </section>

      <section className="reader-capture-pane">
        <header className="reader-capture-header">
          <div className="reader-capture-summary">
            <div className="reader-clock">
              <span><i /><b /></span>
              <div><small>On the clock</small><strong>{elapsed}</strong></div>
            </div>
            <div className="reader-counts">
              <span className="is-study">{counts.study} card</span>
              <span className="is-note">{counts.note} note</span>
              <span className="is-ai">{counts.ai} dir</span>
            </div>
          </div>
          <button
            type="button"
            className="reader-finish-button"
            onClick={onFinish}
            disabled={!hasProcessableChunks || isFinishing || isSaving}
          >
            <Sparkles aria-hidden="true" />
            {processingStage ?? (isFinishing ? "Processing session…" : "End session & create study set")}
          </button>
          <p className="reader-finish-hint">
            {!hasProcessableChunks
              ? "Add at least one study-material or note-only chunk to finish."
              : isSaving
                ? "Syncing your latest changes…"
                : "Sends the trail to the AI for note + flashcard generation."}
          </p>
          {isFinishing && processingStage ? (
            <OperationProgress
              compact
              label={processingStage}
              detail="Keep this page open while the session is filed."
            />
          ) : null}
        </header>

        <div ref={timelineRef} className="reader-stream">
          {chunks.length === 0 ? (
            <div className="reader-stream-empty">
              <MessageSquareText aria-hidden="true" />
              <h2>Your reading trail starts here.</h2>
              <p>Capture facts, private notes, or directions for the AI—without leaving the page. Pick a category below, type, and hit Enter.</p>
            </div>
          ) : (
            chunks.map((chunk, index) => {
              const option = CATEGORY_OPTIONS.find((item) => item.value === chunk.category)!;
              return (
                <article key={chunk.id} className={`reader-chunk is-${option.tone}`}>
                  <div className="reader-chunk-meta">
                    <button type="button" onClick={() => cycleCategory(chunk)} title="Click to recategorize">
                      {option.label} ⇄
                    </button>
                    <span>#{index + 1} · {formatChunkTime(chunk.created_at)}</span>
                    <button
                      type="button"
                      className="reader-chunk-remove"
                      onClick={() => void onRemove(chunk.id)}
                      disabled={isFinishing}
                      aria-label={`Discard chunk ${index + 1}`}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                  <p>{chunk.content}</p>
                </article>
              );
            })
          )}
        </div>

        <footer className={`reader-composer is-${activeOption.tone}`}>
          <CategorySelector value={category} onChange={setCategory} disabled={isFinishing} />
          <div className="reader-compose-box">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              maxLength={4000}
              rows={3}
              disabled={isFinishing}
              placeholder={composerPlaceholder(category)}
              aria-label="Capture a reading thought"
            />
            <button
              type="button"
              onClick={() => void submitDraft()}
              disabled={!draft.trim() || isFinishing}
              aria-label="Save chunk"
            >
              <Send aria-hidden="true" />
            </button>
          </div>
          <div className="reader-compose-status">
            <span>Enter to send · Shift+Enter for a new line</span>
            <span aria-live="polite">{isSaving ? "Syncing…" : activeOption.description} · {draft.length}/4000</span>
          </div>
        </footer>
      </section>
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
    <div className="reader-category-tabs" aria-label="Chunk category">
      {CATEGORY_OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            className={`is-${option.tone}${option.value === value ? " is-active" : ""}`}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            aria-pressed={option.value === value}
            title={option.description}
          >
            <span><Icon aria-hidden="true" /> {option.label}</span>
            <small>{option.sub}</small>
          </button>
        );
      })}
    </div>
  );
}

function ReaderMessage({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "error" }) {
  return <div className={`reader-message${tone === "error" ? " is-error" : ""}`}>{children}</div>;
}

function formatChunkTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "saved";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function composerPlaceholder(category: TypedChunkCategory) {
  if (category === "ai_direction") return "A direction for the AI—e.g. ‘focus cards on causes, not dates’…";
  if (category === "note_only") return "A note to keep (won’t become a card)…";
  return "A fact worth a flashcard… Enter to send";
}
