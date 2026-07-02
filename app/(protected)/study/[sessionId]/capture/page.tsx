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
  const [isSaving, setIsSaving] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const hydratedRef = useRef(false);

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
    setChunks(parseTypedChunks(sessionQuery.data));
    hydratedRef.current = true;
  }, [sessionQuery.data]);

  useEffect(() => {
    if (documentQuery.data?.last_read_page) {
      setCurrentPage(documentQuery.data.last_read_page);
    }
  }, [documentQuery.data?.last_read_page]);

  const persistChunks = async (nextChunks: TypedCaptureChunk[]) => {
    if (!token) {
      throw new Error("You need to be logged in to save reading notes.");
    }

    const session = await api.saveTypedCapture(token, params.sessionId, nextChunks);
    const savedChunks = parseTypedChunks(session);
    setChunks(savedChunks.length === nextChunks.length ? savedChunks : nextChunks);
    await queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const handleSubmit = async (content: string, category: TypedChunkCategory) => {
    const nextChunk: TypedCaptureChunk = {
      id: crypto.randomUUID(),
      content,
      category,
      created_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await persistChunks([...chunks, nextChunk]);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Could not save this chunk."));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategoryChange = async (chunkId: string, category: TypedChunkCategory) => {
    const previousChunks = chunks;
    const nextChunks = chunks.map((chunk) =>
      chunk.id === chunkId ? { ...chunk, category } : chunk,
    );
    if (nextChunks.every((chunk, index) => chunk.category === previousChunks[index]?.category)) {
      return;
    }

    setChunks(nextChunks);
    setIsSaving(true);
    try {
      await persistChunks(nextChunks);
    } catch (error) {
      setChunks(previousChunks);
      toast.error(errorMessage(error, "Could not change this chunk category."));
    } finally {
      setIsSaving(false);
    }
  };

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!token || !documentId) {
        throw new Error("The session or textbook is not ready yet.");
      }

      setProcessingStage("Saving page marker...");
      await api.saveDocumentProgress(token, documentId, currentPage);

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
      isSaving={isSaving}
      onCategoryChange={handleCategoryChange}
      onCurrentPageChange={setCurrentPage}
      onFinish={() => finishMutation.mutate()}
      onSubmit={handleSubmit}
      processingStage={processingStage}
      title={document?.title ?? "Read & note"}
    />
  );
}
