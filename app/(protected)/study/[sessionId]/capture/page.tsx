"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SplitStudyWorkspace } from "@/components/app/split-study-workspace";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import type {
  DocumentRead,
  StudySessionRead,
  TypedCaptureChunk,
  TypedChunkCategory,
} from "@/lib/types";
import { useStopwatch } from "@/hooks/use-stopwatch";

const TYPED_CAPTURE_PROVIDER = "typed-capture-v1";

function parseTypedChunks(session: StudySessionRead | undefined): TypedCaptureChunk[] {
  if (!session?.transcript_text || session.transcript_provider !== TYPED_CAPTURE_PROVIDER) {
    return [];
  }

  try {
    const payload: unknown = JSON.parse(session.transcript_text);
    if (!isRecord(payload) || !Array.isArray(payload.chunks)) {
      return [];
    }

    return payload.chunks.flatMap((value): TypedCaptureChunk[] => {
      if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        typeof value.content !== "string" ||
        typeof value.created_at !== "string" ||
        !isTypedCategory(value.category)
      ) {
        return [];
      }

      return [
        {
          id: value.id,
          content: value.content,
          category: value.category,
          created_at: value.created_at,
        },
      ];
    });
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTypedCategory(value: unknown): value is TypedChunkCategory {
  return value === "study_material" || value === "note_only" || value === "ai_direction";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}

export default function StudyCapturePage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const stopwatch = useStopwatch();
  const [chunks, setChunks] = useState<TypedCaptureChunk[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [manualMarkerPage, setManualMarkerPage] = useState<number | null>(null);
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const [isMarking, setIsMarking] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [completedNoteId, setCompletedNoteId] = useState<string | null | undefined>(undefined);
  const hydratedRef = useRef(false);
  const didInitializePageRef = useRef(false);
  const chunksRef = useRef<TypedCaptureChunk[]>([]);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const markerQueueRef = useRef<Promise<void>>(Promise.resolve());
  const markerVersionRef = useRef(0);

  const sessionQuery = useQuery({
    queryKey: ["sessions", params.sessionId],
    enabled: Boolean(token && params.sessionId),
    queryFn: () => api.getSession(params.sessionId, token!),
  });

  const documentId = sessionQuery.data?.document_id;
  const documentQuery = useQuery({
    queryKey: ["documents", documentId],
    enabled: Boolean(token && documentId),
    queryFn: () => api.getDocument(documentId!, token!),
  });

  const documentFileQuery = useQuery({
    queryKey: ["documents", documentId, "file"],
    enabled: Boolean(token && documentId),
    queryFn: () => api.getDocumentFile(documentId!, token!),
  });

  useEffect(() => {
    if (!sessionQuery.data || hydratedRef.current) {
      return;
    }
    const savedChunks = parseTypedChunks(sessionQuery.data);
    chunksRef.current = savedChunks;
    hydratedRef.current = true;
    const frameId = window.requestAnimationFrame(() => setChunks(savedChunks));
    return () => window.cancelAnimationFrame(frameId);
  }, [sessionQuery.data]);

  useEffect(() => {
    if (!documentQuery.data || didInitializePageRef.current) {
      return;
    }
    didInitializePageRef.current = true;
    const initialPage = documentQuery.data.last_read_page || 1;
    const frameId = window.requestAnimationFrame(() => setCurrentPage(initialPage));
    return () => window.cancelAnimationFrame(frameId);
  }, [documentQuery.data]);

  const queueChunkSave = (nextChunks: TypedCaptureChunk[]) => {
    if (!token) {
      toast.error("You need to be logged in to save reading notes.");
      return false;
    }

    setPendingSaveCount((count) => count + 1);
    const saveOperation = saveQueueRef.current.then(async () => {
      await api.saveTypedCapture(token, params.sessionId, nextChunks);
    });
    saveQueueRef.current = saveOperation
      .catch((error) => {
        toast.error(errorMessage(error, "Could not sync your latest changes. They are still here locally."));
      })
      .finally(() => {
        setPendingSaveCount((count) => Math.max(0, count - 1));
      });
    return true;
  };

  const handleSubmit = async (content: string, category: TypedChunkCategory) => {
    const nextChunk: TypedCaptureChunk = {
      id: crypto.randomUUID(),
      content,
      category,
      created_at: new Date().toISOString(),
    };

    const nextChunks = [...chunksRef.current, nextChunk];
    chunksRef.current = nextChunks;
    setChunks(nextChunks);
    return queueChunkSave(nextChunks);
  };

  const handleCategoryChange = async (chunkId: string, category: TypedChunkCategory) => {
    const previousChunks = chunksRef.current;
    const nextChunks = previousChunks.map((chunk) =>
      chunk.id === chunkId ? { ...chunk, category } : chunk,
    );
    if (nextChunks.every((chunk, index) => chunk.category === previousChunks[index]?.category)) {
      return;
    }

    chunksRef.current = nextChunks;
    setChunks(nextChunks);
    queueChunkSave(nextChunks);
  };

  const handleRemove = async (chunkId: string) => {
    const nextChunks = chunksRef.current.filter((chunk) => chunk.id !== chunkId);
    chunksRef.current = nextChunks;
    setChunks(nextChunks);
    queueChunkSave(nextChunks);
  };

  const handleMarkPage = () => {
    if (!token || !documentId) {
      toast.error("The textbook is not ready to save a marker yet.");
      return;
    }

    const pageToSave = currentPage;
    const previousMarkerPage = manualMarkerPage;
    const version = markerVersionRef.current + 1;
    markerVersionRef.current = version;
    setManualMarkerPage(pageToSave);
    setIsMarking(true);
    toast.success(`Page ${pageToSave} marked. Syncing in the background.`);

    const saveOperation = markerQueueRef.current.then(async () => {
      const progress = await api.saveDocumentProgress(token, documentId, pageToSave);
      queryClient.setQueryData<DocumentRead>(["documents", documentId], (document) =>
        document ? { ...document, ...progress } : document,
      );
      queryClient.setQueryData<DocumentRead[]>(["documents"], (documents) =>
        documents?.map((document) =>
          document.id === documentId ? { ...document, ...progress } : document,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    });
    markerQueueRef.current = saveOperation
      .catch((error) => {
        if (markerVersionRef.current === version) setManualMarkerPage(previousMarkerPage);
        toast.error(errorMessage(error, "Could not sync this page marker."));
      })
      .finally(() => {
        if (markerVersionRef.current === version) setIsMarking(false);
      });
  };

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!token || !documentId) {
        throw new Error("The session or textbook is not ready yet.");
      }

      await saveQueueRef.current;
      await markerQueueRef.current;
      setProcessingStage("Syncing your capture...");
      await api.saveTypedCapture(token, params.sessionId, chunksRef.current);

      setProcessingStage("Saving page marker...");
      await api.saveDocumentProgress(token, documentId, manualMarkerPage ?? currentPage);

      setProcessingStage("Organizing your note and flashcards...");
      return api.processTypedCapture(token, params.sessionId);
    },
    onSuccess: (session) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["flashcards"] }),
      ]);
      toast.success("Your note, flashcards, and resume point are ready.");
      setCompletedNoteId(session.note?.id ?? null);
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Session processing stopped. Your chunks are still saved."));
    },
    onSettled: () => setProcessingStage(null),
  });

  const document = documentQuery.data;
  const loadError = sessionQuery.isError || documentQuery.isError
    ? "The study session could not be loaded."
    : documentFileQuery.isError
      ? "The original PDF could not be loaded from the backend."
      : null;

  const counts = {
    study: chunks.filter((chunk) => chunk.category === "study_material").length,
    note: chunks.filter((chunk) => chunk.category === "note_only").length,
    ai: chunks.filter((chunk) => chunk.category === "ai_direction").length,
  };

  return (
    <>
      <SplitStudyWorkspace
        blob={documentFileQuery.data ?? null}
        chunks={chunks}
        currentPage={currentPage}
        elapsed={stopwatch.formatted}
        error={loadError}
        initialPage={document?.last_read_page || 1}
        isFinishing={finishMutation.isPending}
        isLoading={sessionQuery.isLoading || documentQuery.isLoading || documentFileQuery.isLoading}
        isMarking={isMarking}
        isSaving={pendingSaveCount > 0}
        markedPage={manualMarkerPage ?? document?.last_read_page ?? 0}
        onCategoryChange={handleCategoryChange}
        onCurrentPageChange={setCurrentPage}
        onFinish={() => finishMutation.mutate()}
        onMarkPage={() => void handleMarkPage()}
        onRemove={handleRemove}
        onSubmit={handleSubmit}
        processingStage={processingStage}
        title={document?.title ?? "Read & note"}
      />

      {completedNoteId !== undefined ? (
        <div className="reader-filed-backdrop" role="dialog" aria-modal="true" aria-labelledby="reader-filed-title">
          <div className="reader-filed-card">
            <div className="reader-filed-stamp">Sent to AI</div>
            <h2 id="reader-filed-title">Session filed.</h2>
            <p>
              The AI turned your trail from “{document?.title ?? "this textbook"}” into a polished note and a fresh flashcard deck.
            </p>
            <div className="reader-filed-summary">
              <span className="is-study">▸ {counts.study} chunks → flashcards</span>
              <span className="is-note">▸ {counts.note} chunks → polished note</span>
              <span className="is-ai">▸ {counts.ai} AI directions applied</span>
              <span className="reader-filed-marker">⚑ Bookmark saved at page {manualMarkerPage ?? currentPage}—you’ll resume here.</span>
            </div>
            <div className="reader-filed-actions">
              <Link href={completedNoteId ? `/notes/${completedNoteId}` : "/notes"} className="is-note-action">See the note</Link>
              <Link href="/practice" className="is-practice-action">Drill the deck</Link>
              <button type="button" onClick={() => router.push("/capture")}>Back to shelf</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
