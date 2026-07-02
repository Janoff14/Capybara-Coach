"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SplitStudyWorkspace } from "@/components/app/split-study-workspace";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import type {
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
  const hydratedRef = useRef(false);
  const didInitializePageRef = useRef(false);
  const chunksRef = useRef<TypedCaptureChunk[]>([]);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

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
    setChunks(savedChunks);
    hydratedRef.current = true;
  }, [sessionQuery.data]);

  useEffect(() => {
    if (!documentQuery.data || didInitializePageRef.current) {
      return;
    }
    setCurrentPage(documentQuery.data.last_read_page || 1);
    didInitializePageRef.current = true;
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

  const handleMarkPage = async () => {
    if (!token || !documentId) {
      toast.error("The textbook is not ready to save a marker yet.");
      return;
    }

    setIsMarking(true);
    try {
      await api.saveDocumentProgress(token, documentId, currentPage);
      setManualMarkerPage(currentPage);
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success(`Page ${currentPage} marked as your resume point.`);
    } catch (error) {
      toast.error(errorMessage(error, "Could not save this page marker."));
    } finally {
      setIsMarking(false);
    }
  };

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!token || !documentId) {
        throw new Error("The session or textbook is not ready yet.");
      }

      await saveQueueRef.current;
      setProcessingStage("Syncing your capture...");
      await api.saveTypedCapture(token, params.sessionId, chunksRef.current);

      setProcessingStage("Saving page marker...");
      await api.saveDocumentProgress(token, documentId, manualMarkerPage ?? currentPage);

      setProcessingStage("Organizing your note and flashcards...");
      return api.processTypedCapture(token, params.sessionId);
    },
    onSuccess: async (session) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["flashcards"] }),
      ]);
      toast.success("Your note, flashcards, and resume point are ready.");
      router.push(session.note ? `/notes/${session.note.id}` : "/notes");
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

  return (
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
      onSubmit={handleSubmit}
      processingStage={processingStage}
      title={document?.title ?? "Read & note"}
    />
  );
}
