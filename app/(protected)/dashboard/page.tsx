"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Clock3, FileText, NotebookPen } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import type { DocumentRead, NoteRead, StudySessionRead } from "@/lib/types";

const EMPTY_DOCUMENTS: DocumentRead[] = [];
const EMPTY_SESSIONS: StudySessionRead[] = [];
const EMPTY_NOTES: NoteRead[] = [];

export default function DashboardPage() {
  const { token } = useAuth();

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

  const notesQuery = useQuery({
    queryKey: ["notes"],
    enabled: Boolean(token),
    queryFn: () => api.getNotes(token!),
  });

  const documents = documentsQuery.data ?? EMPTY_DOCUMENTS;
  const sessions = sessionsQuery.data ?? EMPTY_SESSIONS;
  const notes = notesQuery.data ?? EMPTY_NOTES;

  const documentMap = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );

  const isLoading =
    documentsQuery.isLoading || sessionsQuery.isLoading || notesQuery.isLoading;
  const hasError =
    documentsQuery.error || sessionsQuery.error || notesQuery.error;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Everything you need for the next study loop."
        description="Keep the workflow tight: upload source material, start a recall session, and turn the result into notes you can actually review."
        actions={
          <>
            <UploadDocumentDialog />
            <Button variant="secondary" asChild>
              <Link href="/documents">Start study session</Link>
            </Button>
          </>
        }
      />

      <section className="surface-grid-3">
        <MetricCard
          label="Documents"
          value={documents.length.toString()}
          hint="Stored study sources ready to turn into sessions."
        />
        <MetricCard
          label="Sessions"
          value={sessions.length.toString()}
          hint="Reading, recording, and assessment runs tied to your account."
        />
        <MetricCard
          label="Notes"
          value={notes.length.toString()}
          hint="Saved outputs you can revisit once a session is complete."
        />
      </section>

      {hasError ? (
        <EmptyState
          title="We could not load your dashboard."
          description="The backend did not return one of the recent activity lists. Double-check your API base URL and that the Railway backend is up."
        />
      ) : null}

      <section className="surface-grid lg:grid-cols-[1.2fr_1fr_1fr] lg:grid">
        <Card>
          <CardHeader>
            <CardTitle>Recent documents</CardTitle>
            <CardDescription>
              Upload PDFs and jump straight into a session from the documents
              page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-[var(--muted-foreground)]">Loading recent documents...</p>
            ) : documents.length === 0 ? (
              <EmptyState
                title="No documents yet"
                description="Upload your first PDF to start a study session."
                action={<UploadDocumentDialog buttonLabel="Upload your first PDF" />}
              />
            ) : (
              documents.slice(0, 3).map((document) => (
                <div
                  key={document.id}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{document.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {document.page_count} page
                        {document.page_count === 1 ? "" : "s"} -{" "}
                        {document.original_filename}
                      </p>
                    </div>
                    <FileText className="size-5 text-[var(--primary)]" />
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                    Added{" "}
                    {formatDistanceToNow(new Date(document.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardDescription>
              Follow status changes from reading through notes generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-[var(--muted-foreground)]">Loading recent sessions...</p>
            ) : sessions.length === 0 ? (
              <EmptyState
                title="No sessions yet"
                description="Create one from a document to begin the recall flow."
              />
            ) : (
              sessions.slice(0, 3).map((session) => (
                <Link
                  key={session.id}
                  href={`/study/${session.id}/read`}
                  className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4 transition-colors hover:bg-[rgba(73,102,64,0.04)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {documentMap.get(session.document_id)?.title ??
                          "Study session"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        Session {session.id.slice(0, 8)}
                      </p>
                    </div>
                    <SessionStatusBadge status={session.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <Clock3 className="size-3.5" />
                    Updated{" "}
                    {formatDistanceToNow(new Date(session.updated_at), {
                      addSuffix: true,
                    })}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent notes</CardTitle>
            <CardDescription>
              Final outputs from assessed recall sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-[var(--muted-foreground)]">Loading recent notes...</p>
            ) : notes.length === 0 ? (
              <EmptyState
                title="No notes saved"
                description="Finish one full session to generate your first clean note."
              />
            ) : (
              notes.slice(0, 3).map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] p-4 transition-colors hover:bg-[rgba(73,102,64,0.04)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{note.title}</p>
                      <p className="mt-2 line-clamp-3 text-sm text-[var(--muted-foreground)]">
                        {note.summary}
                      </p>
                    </div>
                    <NotebookPen className="size-5 shrink-0 text-[var(--primary)]" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
              Want the cleanest demo path?
            </p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Upload a PDF, start a session from Documents, then follow the
              reading and recording steps straight through.
            </p>
          </div>
          <Button asChild>
            <Link href="/documents">
              Open documents
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
