"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Documents"
        title="Upload source material and turn it into recall sessions."
        description="Keep the MVP simple: PDFs only, one session per document at a time, and a direct path into the reading screen."
        actions={<UploadDocumentDialog buttonLabel="Upload PDF" />}
      />

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
        <div className="surface-grid md:grid-cols-2 xl:grid-cols-3">
          {documents.map((document) => (
            <Card key={document.id} className="h-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{document.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {document.original_filename}
                    </CardDescription>
                  </div>
                  <FileText className="size-5 text-[var(--primary)]" />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm text-[var(--muted-foreground)]">
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Pages
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {document.page_count}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Type
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {document.source_type.toUpperCase()}
                    </p>
                  </div>
                </div>

                <p className="line-clamp-4 text-sm leading-7 text-[var(--muted-foreground)]">
                  {document.extracted_text}
                </p>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Added {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
