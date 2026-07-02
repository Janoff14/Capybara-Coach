"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bookmark,
  BookOpenText,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

export default function CaptureLibraryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    enabled: Boolean(token),
    queryFn: () => api.getDocuments(token!),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    enabled: Boolean(token),
    queryFn: () => api.getSessions(token!),
  });

  const createSessionMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!token) {
        throw new Error("You need to be logged in to start a reading session.");
      }

      setPendingDocumentId(documentId);
      return api.createSession(token, documentId);
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.push(`/study/${session.id}/capture`);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not start the reading session.",
      );
    },
    onSettled: () => setPendingDocumentId(null),
  });

  const documents = documentsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const resumableByDocument = new Map(
    sessions
      .filter(
        (session) =>
          session.transcript_provider === "typed-capture-v1" &&
          session.status === "capturing_notes",
      )
      .map((session) => [session.document_id, session]),
  );

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-[34px] border border-[var(--border-soft)] bg-[linear-gradient(135deg,rgba(75,102,72,0.96),rgba(63,83,61,0.92))] px-7 py-8 text-white shadow-[var(--shadow-panel)] md:px-10 md:py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              <MessageSquareText className="size-4" />
              Keyboard study mode
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">
              Read the page. Capture the thought.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/76">
              Keep your textbook open beside a categorized note stream, then turn the whole session into a polished note and flashcards when you finish.
            </p>
          </div>
          <UploadDocumentDialog buttonLabel="Add textbook" buttonVariant="secondary" />
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tertiary)]">
              Your textbooks
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.05em] text-[var(--foreground)]">
              Pick up where you left off.
            </h2>
          </div>
          <p className="hidden text-sm text-[var(--muted-foreground)] sm:block">
            {documents.length} textbook{documents.length === 1 ? "" : "s"}
          </p>
        </div>

        {documentsQuery.isError || sessionsQuery.isError ? (
          <EmptyState
            title="We could not load your reading library"
            description="Check that the study service is reachable, then try again."
          />
        ) : documentsQuery.isLoading || sessionsQuery.isLoading ? (
          <Card>
            <CardContent className="py-10 text-sm text-[var(--muted-foreground)]">
              Loading your textbooks and saved sessions...
            </CardContent>
          </Card>
        ) : documents.length === 0 ? (
          <EmptyState
            title="Add your first textbook"
            description="Upload a PDF here or from Documents. Both study modes use the same library."
            action={<UploadDocumentDialog buttonLabel="Upload a PDF" />}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => {
              const resumableSession = resumableByDocument.get(document.id);
              const isPending = pendingDocumentId === document.id;

              return (
                <Card key={document.id} className="flex h-full flex-col overflow-hidden">
                  <div className="h-2 bg-[linear-gradient(90deg,var(--primary),var(--primary-soft))]" />
                  <CardHeader className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--sidebar-active)] text-[var(--primary)]">
                        <BookOpenText className="size-5" />
                      </div>
                      {resumableSession ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-900">
                          Draft open
                        </span>
                      ) : null}
                    </div>
                    <CardTitle className="mt-5 text-2xl">{document.title}</CardTitle>
                    <CardDescription className="line-clamp-3 leading-6">
                      {document.extracted_text}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4">
                      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                        <span className="flex items-center gap-2 text-[var(--foreground-soft)]">
                          <Bookmark className="size-4 text-[var(--primary)]" />
                          {document.last_read_page > 0
                            ? `Page ${document.last_read_page} of ${document.page_count}`
                            : `${document.page_count} pages · Not started`}
                        </span>
                        <span className="tabular-nums text-[var(--muted-foreground)]">
                          {document.progress_percent}%
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(75,102,72,0.10)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)]"
                          style={{ width: `${document.progress_percent}%` }}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => {
                        if (resumableSession) {
                          router.push(`/study/${resumableSession.id}/capture`);
                          return;
                        }
                        createSessionMutation.mutate(document.id);
                      }}
                      disabled={createSessionMutation.isPending}
                    >
                      {isPending ? (
                        "Opening reader..."
                      ) : (
                        <>
                          {resumableSession ? "Continue read & note" : "Start read & note"}
                          {resumableSession ? <Sparkles className="size-4" /> : <ArrowRight className="size-4" />}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
