"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

export default function DocumentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    enabled: Boolean(token),
    queryFn: () => api.getDocuments(token!),
  });

  const createSessionMutation = useMutation({
    mutationFn: async (documentId: string) => {
      if (!token) {
        throw new Error("You need to be logged in to create a session.");
      }

      setPendingDocumentId(documentId);
      return api.createSession(token, documentId);
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Study session created.");
      router.push(`/study/${session.id}/read`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not create the study session.";
      toast.error(message);
    },
    onSettled: () => setPendingDocumentId(null),
  });

  const documents = documentsQuery.data ?? [];

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tertiary)]">
            Knowledge repository
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-[-0.06em] text-[var(--foreground)] sm:text-5xl">
            Upload source material and turn it into recall sessions.
          </h1>
          <p className="mt-5 text-base leading-8 text-[var(--foreground-soft)]">
            Keep the MVP path direct: PDFs only, one document per session flow, and
            a straight route into reading, recall, assessment, and notes.
          </p>
        </div>
        <UploadDocumentDialog buttonLabel="Upload PDF" />
      </section>

      {documentsQuery.isError ? (
        <EmptyState
          title="We could not load your documents."
          description="Check that your backend is reachable and try again."
        />
      ) : null}

      {documentsQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-[var(--muted-foreground)]">
            Loading your document library...
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <EmptyState
          title="Your document library is empty"
          description="Upload a PDF and then start a study session directly from its card."
          action={<UploadDocumentDialog buttonLabel="Upload your first PDF" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {documents.map((document, index) => {
            const featured = index === 0 && documents.length > 1;

            return (
              <article
                key={document.id}
                className={
                  featured
                    ? "lg:col-span-7"
                    : documents.length === 1
                      ? "lg:col-span-7"
                      : "lg:col-span-5"
                }
              >
                <div
                  className={
                    featured
                      ? "editorial-panel flex h-full flex-col overflow-hidden rounded-[32px] border border-[var(--border-soft)]"
                      : "flex h-full flex-col rounded-[32px] bg-[rgba(212,228,246,0.58)] p-7 shadow-[var(--shadow-soft)]"
                  }
                >
                  {featured ? (
                    <div className="relative h-48 bg-[linear-gradient(180deg,rgba(75,102,72,0.92)_0%,rgba(64,89,61,0.92)_100%)]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(253,218,178,0.16),transparent_34%)]" />
                      <div className="absolute bottom-6 left-6 flex gap-2">
                        <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white">
                          PDF
                        </span>
                        <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white">
                          {document.page_count} pages
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-white text-[var(--tertiary)] shadow-[var(--shadow-soft)]">
                      <FileText className="size-5" />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--primary)]">
                          {document.source_type.toUpperCase()}
                        </p>
                        <h2 className="mt-3 font-display text-2xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
                          {document.title}
                        </h2>
                      </div>
                      {featured ? (
                        <Sparkles className="size-5 text-[var(--primary-soft)]" />
                      ) : null}
                    </div>

                    <p className="mt-4 line-clamp-4 text-sm leading-7 text-[var(--foreground-soft)]">
                      {document.extracted_text}
                    </p>

                    <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Pages
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                          {document.page_count}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                          Added
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {formatDistanceToNow(new Date(document.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 flex items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-6">
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {document.original_filename}
                      </p>
                      <Button
                        onClick={() => createSessionMutation.mutate(document.id)}
                        disabled={
                          createSessionMutation.isPending &&
                          pendingDocumentId === document.id
                        }
                      >
                        {createSessionMutation.isPending &&
                        pendingDocumentId === document.id ? (
                          "Starting..."
                        ) : (
                          <>
                            Start session
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
