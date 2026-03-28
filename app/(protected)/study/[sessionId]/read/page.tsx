"use client";

import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { PdfViewer } from "@/components/app/pdf-viewer";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Study session"
        title={document?.title ?? "Read the source"}
        description="Use this screen to read the source material clearly, then move straight into the recording step when you are ready to explain it from memory."
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
              {finishMutation.isPending ? "Finishing..." : "Finish reading"}
            </Button>
          </>
        }
      />

      <div className="surface-grid xl:grid-cols-[1.55fr_0.85fr] xl:grid">
        <PdfViewer
          blob={documentFileQuery.data ?? null}
          isLoading={documentFileQuery.isLoading || sessionQuery.isLoading || documentQuery.isLoading}
          error={
            documentFileQuery.isError
              ? "The PDF could not be loaded from the backend."
              : null
          }
          title={document?.title ?? "Source document"}
        />

        <div className="surface-grid">
          <Card>
            <CardHeader>
              <CardTitle>Source overview</CardTitle>
              <CardDescription>
                Keep the important ideas in mind before you hit the recording step.
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
              <CardTitle>Extracted text preview</CardTitle>
              <CardDescription>
                This is what the backend extracted from the uploaded PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[36rem] overflow-auto whitespace-pre-wrap text-sm leading-7 text-[var(--muted-foreground)]">
                {document?.extracted_text ?? "Loading extracted text..."}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
