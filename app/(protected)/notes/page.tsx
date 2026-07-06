"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, FileText } from "lucide-react";

import { OperationProgress } from "@/components/app/operation-progress";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api";

export default function NotesPage() {
  const { token } = useAuth();
  const notesQuery = useQuery({ queryKey: ["notes"], enabled: Boolean(token), queryFn: () => api.getNotes(token!) });
  const notes = notesQuery.data ?? [];

  return (
    <div className="catalog-notes-index">
      <section className="catalog-page-title">
        <div>
          <p className="reader-overline">Drawer 05 — filed notes</p>
          <h1>Notes on file</h1>
          <p>Cleaned, structured write-ups generated after each assessed recall. Pull a folder to open the full note.</p>
        </div>
      </section>

      {notesQuery.isError ? <div className="catalog-notice is-error">The notes drawer could not be loaded.</div> : null}
      {notesQuery.isLoading ? (
        <div className="catalog-empty-card"><OperationProgress label="Checking filed folders" detail="Loading your generated study notes." /></div>
      ) : notes.length === 0 ? (
        <div className="catalog-empty-card"><FileText /><h3>No notes filed yet.</h3><p>Finish a recall or reading session to create the first clean note.</p><Link href="/documents">Go to documents →</Link></div>
      ) : (
        <section className="catalog-note-folders">
          {notes.map((note, index) => (
            <Link key={note.id} href={`/notes/${note.id}`} className="catalog-note-folder" style={{ animationDelay: `${index * 60}ms` }}>
              <i />
              <span className="reader-overline">NOTE · {note.id.slice(0, 8).toUpperCase()}</span>
              <h2>{note.title}</h2>
              <p>{note.summary}</p>
              <footer><span>filed {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span><strong>Open <ArrowRight /></strong></footer>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
