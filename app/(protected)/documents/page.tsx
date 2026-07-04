"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { BookOpenText, LoaderCircle, Mic2, NotebookPen } from "lucide-react";
import { toast } from "sonner";

import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api";

type Filter = "ALL" | "READING" | "READY";

export default function DocumentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [pendingSessionKey, setPendingSessionKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  const documentsQuery = useQuery({ queryKey: ["documents"], enabled: Boolean(token), queryFn: () => api.getDocuments(token!) });
  const sessionsQuery = useQuery({ queryKey: ["sessions"], enabled: Boolean(token), queryFn: () => api.getSessions(token!) });
  const documents = documentsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const visibleDocuments = documents.filter((document) =>
    filter === "READING" ? document.progress_percent > 0 && document.progress_percent < 100
      : filter === "READY" ? document.progress_percent >= 100
        : true,
  );

  const createSessionMutation = useMutation({
    mutationFn: async ({ documentId, mode }: { documentId: string; mode: "audio" | "capture" }) => {
      if (!token) throw new Error("You need to be logged in to create a session.");
      setPendingSessionKey(`${documentId}:${mode}`);
      return api.createSession(token, documentId);
    },
    onSuccess: async (session, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.push(variables.mode === "capture" ? `/study/${session.id}/capture` : `/study/${session.id}/read`);
    },
    onError: (error) => toast.error(error instanceof ApiError || error instanceof Error ? error.message : "Could not create the study session."),
    onSettled: () => setPendingSessionKey(null),
  });

  return (
    <div className="catalog-documents">
      <section className="catalog-page-title">
        <div>
          <p className="reader-overline">Drawer 02 — source material</p>
          <h1>The catalog</h1>
          <p>Every PDF gets a card, a call number, and a straight path into a recall session.</p>
        </div>
        <div className="catalog-folder-tabs">
          {(["ALL", "READING", "READY"] as Filter[]).map((item) => (
            <button key={item} type="button" className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>
              {item} ({item === "ALL" ? documents.length : documents.filter((document) => item === "READING" ? document.progress_percent > 0 && document.progress_percent < 100 : document.progress_percent >= 100).length})
            </button>
          ))}
        </div>
      </section>

      {documentsQuery.isError ? <div className="catalog-notice is-error">The catalog drawer would not open. Check the API connection.</div> : null}

      <section className="catalog-library-grid">
        <UploadDocumentDialog buttonLabel="New acquisition" buttonClassName="catalog-new-acquisition" />
        {documentsQuery.isLoading ? (
          <div className="catalog-empty-card"><LoaderCircle className="reader-spin" /><h3>Reading the card index…</h3></div>
        ) : visibleDocuments.length === 0 ? (
          <div className="catalog-empty-card"><BookOpenText /><h3>No cards in this drawer.</h3><p>Try another filter or catalog a new PDF.</p></div>
        ) : visibleDocuments.map((document, index) => (
          <article key={document.id} className="catalog-library-card" style={{ transform: `rotate(${index % 2 ? ".35" : "-.35"}deg)` }}>
            <span className="catalog-subject-tab">{document.source_type.slice(0, 4).toUpperCase()}</span>
            <header><span>{document.id.slice(0, 8).toUpperCase()}</span><span>PDF · {document.page_count} p.</span></header>
            <div>
              <div className="catalog-library-card-title"><h2>{document.title}</h2><em>{document.progress_percent >= 100 ? "Read" : document.progress_percent > 0 ? "Reading" : "New"}</em></div>
              <p>{document.extracted_text || document.original_filename}</p>
              <div className="catalog-card-progress"><i style={{ width: `${document.progress_percent}%` }} /></div>
              <small>added {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })} · page {document.last_read_page || 1}</small>
              <div className="catalog-library-actions">
                <button type="button" onClick={() => createSessionMutation.mutate({ documentId: document.id, mode: "audio" })} disabled={createSessionMutation.isPending}>
                  {pendingSessionKey === `${document.id}:audio` ? <LoaderCircle className="reader-spin" /> : <Mic2 />} Recall
                </button>
                <button type="button" className="is-primary" onClick={() => createSessionMutation.mutate({ documentId: document.id, mode: "capture" })} disabled={createSessionMutation.isPending}>
                  {pendingSessionKey === `${document.id}:capture` ? <LoaderCircle className="reader-spin" /> : <NotebookPen />} Read &amp; note
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="catalog-checkout-log">
        <header><h2>Checkout log <span>(every session, stamped)</span></h2><small>{sessions.length} records</small></header>
        <div>
          {sessions.length === 0 ? <p>No sessions checked out yet.</p> : sessions.slice(0, 6).map((session) => {
            const document = documents.find((item) => item.id === session.document_id);
            return (
              <button key={session.id} type="button" onClick={() => router.push(`/study/${session.id}/read`)}>
                <strong>{document?.title ?? "Study session"}</strong><span>sess. {session.id.slice(0, 8)}</span>
                <span>{formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}</span><em>{session.status.replaceAll("_", " ")}</em>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
