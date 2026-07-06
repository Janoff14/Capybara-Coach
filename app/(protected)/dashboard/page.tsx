"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, BookOpenText, CalendarClock, NotebookPen, PanelsTopLeft } from "lucide-react";

import { UploadDocumentDialog } from "@/components/app/upload-document-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api";
import { groupFlashcardsIntoDecks } from "@/lib/flashcards";
import { sessionDestination } from "@/lib/session-navigation";

export default function DashboardPage() {
  const { token } = useAuth();
  const documentsQuery = useQuery({ queryKey: ["documents"], enabled: Boolean(token), queryFn: () => api.getDocuments(token!) });
  const sessionsQuery = useQuery({ queryKey: ["sessions"], enabled: Boolean(token), queryFn: () => api.getSessions(token!) });
  const notesQuery = useQuery({ queryKey: ["notes"], enabled: Boolean(token), queryFn: () => api.getNotes(token!) });
  const flashcardsQuery = useQuery({ queryKey: ["flashcards"], enabled: Boolean(token), queryFn: () => api.getFlashcards(token!) });
  const reviewsQuery = useQuery({ queryKey: ["reviews"], enabled: Boolean(token), queryFn: () => api.getReviews(token!) });

  const documents = documentsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const notes = notesQuery.data ?? [];
  const decks = useMemo(() => groupFlashcardsIntoDecks(flashcardsQuery.data ?? []), [flashcardsQuery.data]);
  const dueReviews = (reviewsQuery.data ?? []).filter((review) => review.is_due);
  const documentMap = new Map(documents.map((document) => [document.id, document]));
  const hasError = [documentsQuery, sessionsQuery, notesQuery, flashcardsQuery, reviewsQuery].some((query) => query.isError);
  const isLoading = [documentsQuery, sessionsQuery, notesQuery, flashcardsQuery, reviewsQuery].some((query) => query.isLoading);

  return (
    <div className="catalog-dashboard">
      <section className="catalog-dashboard-top">
        <article className="catalog-ledger">
          <header>
            <span>Study ledger · card № 001</span>
            <span>{format(new Date(), "EEE · MMM d · yyyy")}</span>
          </header>
          <h1>What&apos;s on the desk this morning</h1>
          <p>
            {documents.length} documents catalogued. {notes.length} notes filed. {dueReviews.length} deck{dueReviews.length === 1 ? "" : "s"} stamped DUE.
            Keep the loop moving: read, recall, assess, file, drill.
          </p>
          <div className="catalog-route-strip">
            {["READ", "RECALL", "ASSESS", "NOTE", "DRILL"].map((label, index) => (
              <div key={label} className={index === 1 ? "is-here" : index === 0 ? "is-done" : ""}>
                <strong>{label}</strong>
                <span>{index === 0 ? "✓ done" : index === 1 ? "you are here" : index === 4 ? `${dueReviews.length} due` : "up next"}</span>
              </div>
            ))}
          </div>
          <div className="catalog-ledger-actions">
            <UploadDocumentDialog buttonLabel="Catalog a PDF" buttonClassName="reader-stamp-button" />
            <Link href="/capture">Open reading room <ArrowRight /></Link>
          </div>
        </article>

        <aside className="catalog-due-card">
          <div className="catalog-due-stamp">{dueReviews.length ? "Due" : "Clear"}</div>
          <p className="reader-overline">Overdue slip</p>
          <strong>{dueReviews.length}</strong>
          <h2>{dueReviews.length === 1 ? "deck wants a word" : "decks want a word"}</h2>
          <p>{dueReviews.length ? "Retrieval first. Seven cards and the desk is square." : "Nothing overdue. A suspiciously tidy desk."}</p>
          <Link href="/practice">Go drill →</Link>
        </aside>
      </section>

      {hasError ? <div className="catalog-notice is-error">One of the desk drawers could not be loaded. Check the local API and try again.</div> : null}

      <section className="catalog-section-heading">
        <div><p className="reader-overline">Recently catalogued</p><h2>Cards on the desk</h2></div>
        <span>{isLoading ? "checking drawers…" : `${documents.length} records`}</span>
      </section>

      <section className="catalog-document-cards">
        {documents.length === 0 ? (
          <div className="catalog-empty-card"><BookOpenText /><h3>No source cards yet.</h3><p>Catalog a PDF to start the first study loop.</p></div>
        ) : documents.slice(0, 3).map((document, index) => (
          <article key={document.id} style={{ transform: `rotate(${index % 2 ? ".35" : "-.35"}deg)` }}>
            <span className="catalog-subject-tab">PDF</span>
            <header><span>{document.id.slice(0, 8).toUpperCase()}</span><span>{document.page_count} pp.</span></header>
            <h3>{document.title}</h3>
            <p>{document.extracted_text || document.original_filename}</p>
            <footer>
              <span>added {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}</span>
              <Link href="/capture">Read →</Link>
            </footer>
          </article>
        ))}
      </section>

      <section className="catalog-dashboard-bottom">
        <DeskList title="Checkout log" icon={<CalendarClock />}>
          {sessions.length === 0 ? <p className="catalog-list-empty">No sessions stamped yet.</p> : sessions.slice(0, 4).map((session) => (
            <Link key={session.id} href={sessionDestination(session)}>
              <span><strong>{documentMap.get(session.document_id)?.title ?? "Study session"}</strong><small>sess. {session.id.slice(0, 8)}</small></span>
              <em>{session.status.replaceAll("_", " ")}</em>
            </Link>
          ))}
        </DeskList>
        <DeskList title="Flashcard decks" icon={<PanelsTopLeft />}>
          {decks.length === 0 ? <p className="catalog-list-empty">No decks punched yet.</p> : decks.slice(0, 4).map((deck) => (
            <Link key={deck.sessionId} href={`/practice?sessionId=${deck.sessionId}`}>
              <span><strong>{deck.documentTitle}</strong><small>{deck.cards.length} cards punched</small></span><em>Drill</em>
            </Link>
          ))}
        </DeskList>
        <DeskList title="Fresh notes" icon={<NotebookPen />}>
          {notes.length === 0 ? <p className="catalog-list-empty">No notes filed yet.</p> : notes.slice(0, 4).map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`}>
              <span><strong>{note.title}</strong><small>{note.summary}</small></span><em>Open</em>
            </Link>
          ))}
        </DeskList>
      </section>
    </div>
  );
}

function DeskList({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <article className="catalog-desk-list"><header><h2>{title}</h2>{icon}</header><div>{children}</div></article>;
}
