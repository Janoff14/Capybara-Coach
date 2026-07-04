"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookOpenText,
  LoaderCircle,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";
import { useAuth } from "@/components/providers/auth-provider";
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
    <div className="reader-library">
      <section className="reader-library-hero">
        <div>
          <p className="reader-overline">
            <MessageSquareText aria-hidden="true" /> Read &amp; note · reading room
          </p>
          <h1>Read the page. Capture the thought beside it.</h1>
          <p className="reader-library-intro">
            Keep the textbook open on the left and build a categorized note stream on the right.
            End the session and the whole trail becomes a polished note and a flashcard deck.
          </p>
        </div>
        <UploadDocumentDialog
          buttonLabel="Add textbook"
          buttonVariant="secondary"
          buttonClassName="reader-library-add"
        />
      </section>

      <section>
        <div className="reader-library-heading">
          <div>
            <p className="reader-overline">Your textbooks</p>
            <h2>Pick up where you left off.</h2>
          </div>
          <p className="reader-library-count">
            {documents.length} textbook{documents.length === 1 ? "" : "s"}
          </p>
        </div>

        {documentsQuery.isError || sessionsQuery.isError ? (
          <div className="reader-library-state is-error">
            <AlertTriangle aria-hidden="true" />
            <h3>We could not load your reading library.</h3>
            <p>Check that the study service is reachable, then try again.</p>
          </div>
        ) : documentsQuery.isLoading || sessionsQuery.isLoading ? (
          <div className="reader-library-state">
            <LoaderCircle className="reader-spin" aria-hidden="true" />
            <h3>Checking the shelves…</h3>
            <p>Loading your textbooks and saved sessions.</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="reader-library-state">
            <BookOpenText aria-hidden="true" />
            <h3>Add your first textbook.</h3>
            <p>Upload a PDF here or from Documents. Both study modes use the same library.</p>
            <UploadDocumentDialog buttonLabel="Upload a PDF" buttonClassName="reader-stamp-button" />
          </div>
        ) : (
          <div className="reader-book-grid">
            {documents.map((document, index) => {
              const resumableSession = resumableByDocument.get(document.id);
              const isPending = pendingDocumentId === document.id;

              return (
                <article
                  key={document.id}
                  className="reader-book-card"
                  style={{ animationDelay: `${Math.min(index, 8) * 60 + 120}ms` }}
                >
                  <div className="reader-book-stripe" />
                  <div className="reader-book-card-body">
                    <div className="reader-book-card-topline">
                      <div className="reader-book-icon">
                        <BookOpenText aria-hidden="true" />
                      </div>
                      {resumableSession ? <span className="reader-draft-stamp">Draft open</span> : null}
                    </div>

                    <h3>{document.title}</h3>
                    <p className="reader-book-blurb">{document.extracted_text}</p>

                    <div className="reader-progress-card">
                      <div>
                        <span>
                          <Bookmark aria-hidden="true" />
                          {document.last_read_page > 0
                            ? `Page ${document.last_read_page} of ${document.page_count}`
                            : `${document.page_count} pages · Not started`}
                        </span>
                        <strong>{document.progress_percent}%</strong>
                      </div>
                      <div className="reader-progress-track">
                        <i style={{ width: `${document.progress_percent}%` }} />
                      </div>
                    </div>

                    <button
                      type="button"
                      className={resumableSession ? "reader-book-action is-resume" : "reader-book-action"}
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
                        <><LoaderCircle className="reader-spin" /> Opening reader…</>
                      ) : (
                        <>
                          {resumableSession ? "Continue read & note" : "Start read & note"}
                          {resumableSession ? <Sparkles /> : <ArrowRight />}
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
