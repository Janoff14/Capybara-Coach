"use client";

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DocumentReader } from "@/components/app/document-reader";
import { PageHeader } from "@/components/app/page-header";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { buildReaderGuide, estimateReadingMinutes } from "@/lib/document-reader";
import { useStopwatch } from "@/hooks/use-stopwatch";

export default function StudyReadPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const stopwatch = useStopwatch();
  const [currentPage, setCurrentPage] = useState(1);

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

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("You need to be logged in to update the session.");
      }

      if (documentId) {
        await api.saveDocumentProgress(token, documentId, currentPage);
      }
      return api.finishReading(token, params.sessionId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions", params.sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Reading marked as complete.");
      router.push(`/study/${params.sessionId}/record?autostart=1`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not update the session.";
      toast.error(message);
    },
  });

  const session = sessionQuery.data;
  const document = documentQuery.data;
  const readerGuide = useMemo(
    () => buildReaderGuide(document?.extracted_text ?? "", document?.reader_json ?? null),
    [document?.extracted_text, document?.reader_json],
  );
  const readingMinutes = useMemo(
    () => estimateReadingMinutes(document?.extracted_text ?? ""),
    [document?.extracted_text],
  );

  return (
    <div className="catalog-study-page space-y-8">
      <PageHeader
        eyebrow="Study session"
        title={document?.title ?? "Read the source"}
        description="Read through the source in a calmer study view, then move straight into recall mode when you are ready to explain it from memory."
        actions={
          <>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Reading timer
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-[var(--foreground)]">
                {stopwatch.formatted}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Read time
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-[var(--foreground)]">
                {readingMinutes > 0 ? `${readingMinutes} min` : "--"}
              </p>
            </div>
            {session ? <SessionStatusBadge status={session.status} /> : null}
            <Button onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}>
              {finishMutation.isPending ? "Starting recall..." : "Start recall"}
            </Button>
          </>
        }
      />

      <DocumentReader
        blob={documentFileQuery.data ?? null}
        error={documentFileQuery.isError ? "The original PDF could not be loaded from the backend." : null}
        importantSentences={readerGuide.importantSentences}
        isLoading={sessionQuery.isLoading || documentQuery.isLoading || documentFileQuery.isLoading}
        keyTerms={readerGuide.keyTerms}
        sections={readerGuide.sections}
        title={document?.title ?? "Source document"}
        initialPage={document?.last_read_page || 1}
        onCurrentPageChange={setCurrentPage}
      />
    </div>
  );
}
