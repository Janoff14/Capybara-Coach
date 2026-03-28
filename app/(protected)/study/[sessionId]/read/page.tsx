"use client";

import { useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DocumentReader } from "@/components/app/document-reader";
import { PageHeader } from "@/components/app/page-header";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { buildReaderSections, estimateReadingMinutes } from "@/lib/document-reader";
import { formatElapsed } from "@/lib/utils";
import { useStopwatch } from "@/hooks/use-stopwatch";

export default function StudyReadPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const stopwatch = useStopwatch();

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

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("You need to be logged in to update the session.");
      }

      return api.finishReading(token, params.sessionId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions", params.sessionId] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Reading marked as complete.");
      router.push(`/study/${params.sessionId}/record`);
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
  const readerSections = useMemo(
    () => buildReaderSections(document?.extracted_text ?? ""),
    [document?.extracted_text],
  );
  const readingMinutes = useMemo(
    () => estimateReadingMinutes(document?.extracted_text ?? ""),
    [document?.extracted_text],
  );

  return (
    <div className="space-y-8">
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
            {session ? <SessionStatusBadge status={session.status} /> : null}
            <Button onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}>
              {finishMutation.isPending ? "Starting recall..." : "Start recall"}
            </Button>
          </>
        }
      />

      <div className="surface-grid xl:grid-cols-[1.55fr_0.85fr] xl:grid">
        <DocumentReader
          sections={readerSections}
          isLoading={sessionQuery.isLoading || documentQuery.isLoading}
          title={document?.title ?? "Source document"}
        />

        <div className="surface-grid">
          <Card>
            <CardHeader>
              <CardTitle>Reading overview</CardTitle>
              <CardDescription>
                This keeps the study step grounded without turning it into a dense file inspector.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    Pages
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {document?.page_count ?? "--"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    Read time
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {readingMinutes > 0 ? `${readingMinutes} min` : "--"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    Sections
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {readerSections.length || "--"}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    Elapsed
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                    {formatElapsed(stopwatch.elapsedSeconds)}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                {document?.original_filename ?? "Fetching document details..."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reading map</CardTitle>
              <CardDescription>
                Use the section flow to pace yourself before you move into recall.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {readerSections.length > 0 ? (
                readerSections.map((section) => (
                  <div
                    key={section.id}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                      {section.label}
                    </p>
                    <p className="mt-2 font-display text-xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
                      {section.title}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                      {section.preview}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4 text-sm leading-7 text-[var(--muted-foreground)]">
                  {document?.extracted_text
                    ? "The reader is still organizing this text into sections."
                    : "Loading extracted text..."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
