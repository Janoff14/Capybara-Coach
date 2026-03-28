"use client";

import { useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, Highlighter, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { DocumentReader } from "@/components/app/document-reader";
import { PageHeader } from "@/components/app/page-header";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { buildReaderGuide, estimateReadingMinutes } from "@/lib/document-reader";
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
  const readerGuide = useMemo(
    () => buildReaderGuide(document?.extracted_text ?? "", document?.reader_json ?? null),
    [document?.extracted_text, document?.reader_json],
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
          sections={readerGuide.sections}
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
                    {readerGuide.sections.length || "--"}
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
              {readerGuide.importantSentences.length > 0 ? (
                <div className="rounded-[20px] border border-[rgba(194,200,190,0.4)] bg-[rgba(245,212,140,0.12)] px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Highlighter className="size-4 text-[var(--primary)]" />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                      Reader focus
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                    {readerGuide.importantSentences[0]}
                  </p>
                </div>
              ) : null}
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
              {readerGuide.sections.length > 0 ? (
                readerGuide.sections.map((section) => (
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

          {readerGuide.keyTerms.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Key terms</CardTitle>
                <CardDescription>
                  A lightweight glossary for the concepts the reader should keep track of.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {readerGuide.keyTerms.map((item) => (
                  <div
                    key={item.term}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4"
                  >
                    <div className="flex items-start gap-2">
                      <BookOpenText className="mt-1 size-4 shrink-0 text-[var(--primary)]" />
                      <div>
                        <p className="font-display text-lg font-bold tracking-[-0.04em] text-[var(--foreground)]">
                          {item.term}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                          {item.definition}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Key terms</CardTitle>
                <CardDescription>
                  This panel will fill in with extracted concepts as soon as the upload has reader guidance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4 text-sm leading-7 text-[var(--muted-foreground)]">
                  The current document does not have glossary-style terms yet, so the reading map is carrying the study guidance for now.
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Guidance legend</CardTitle>
              <CardDescription>
                The highlight layer stays lightweight on purpose so it guides attention without turning into spoilers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted-foreground)]">
              <div className="flex items-start gap-3 rounded-[18px] border border-amber-300/45 bg-amber-300/10 px-4 py-4">
                <Sparkles className="mt-1 size-4 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Key idea</p>
                  <p className="mt-1 leading-7">
                    Main claims or anchor concepts that should stay in memory.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-[18px] border border-sky-300/45 bg-sky-300/10 px-4 py-4">
                <Sparkles className="mt-1 size-4 shrink-0 text-sky-700" />
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Definition</p>
                  <p className="mt-1 leading-7">
                    Terms or concept explanations that need precise wording.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-[18px] border border-emerald-300/45 bg-emerald-300/10 px-4 py-4">
                <Sparkles className="mt-1 size-4 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Example</p>
                  <p className="mt-1 leading-7">
                    Concrete cases that make the concept easier to recall later.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
