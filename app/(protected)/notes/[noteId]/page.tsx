"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, LoaderCircle, Mic2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { formatNote } from "@/lib/note-format";

export default function NoteDetailPage() {
  const params = useParams<{ noteId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const noteQuery = useQuery({ queryKey: ["notes", params.noteId], enabled: Boolean(token && params.noteId), queryFn: () => api.getNote(params.noteId, token!) });
  const note = noteQuery.data;
  const formattedNote = note ? formatNote(note) : null;

  const startRecallMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("You need to be logged in to start note recall.");
      return api.createNoteRecallSession(token, params.noteId);
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.push(`/study/${session.id}/record?autostart=1`);
    },
    onError: (error) => toast.error(error instanceof ApiError || error instanceof Error ? error.message : "Could not start note recall."),
  });

  if (noteQuery.isLoading) return <div className="catalog-empty-card"><LoaderCircle className="reader-spin" /><h3>Pulling the folder…</h3></div>;
  if (noteQuery.isError || !note || !formattedNote) return <div className="catalog-empty-card"><h3>This note could not be loaded.</h3><Link href="/notes">Back to notes</Link></div>;

  return (
    <div className="catalog-note-detail">
      <div className="catalog-note-detail-nav">
        <Link href="/notes"><ArrowLeft /> Filed folders</Link>
        <button type="button" onClick={() => startRecallMutation.mutate()} disabled={startRecallMutation.isPending}>
          <Mic2 /> {startRecallMutation.isPending ? "Opening recorder…" : "Recall again"}
        </button>
      </div>

      <article className="catalog-note-paper">
        <i className="catalog-note-rule" />
        <header>
          <div><p className="reader-overline">NOTE · {note.id.slice(0, 8).toUpperCase()} · filed {format(new Date(note.created_at), "PPP")}</p><h1>{note.title}</h1></div>
          <span>Filed clean</span>
        </header>
        <div className="catalog-note-paper-body">
          <p className="catalog-note-summary">{note.summary}</p>

          {formattedNote.takeaways.length ? <>
            <h2>Key points</h2>
            <ul className="catalog-note-points">{formattedNote.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
          </> : null}

          {formattedNote.sections.map((section) => (
            <section key={section.id} className="catalog-note-section">
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={`${section.id}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}
              {section.bullets.length ? <ul>{section.bullets.map((bullet) => <li key={`${section.id}-${bullet.slice(0, 24)}`}>{bullet}</li>)}</ul> : null}
            </section>
          ))}

          {formattedNote.blocks.map((block) => block.type === "list"
            ? <ul key={block.id} className="catalog-note-points">{block.items.map((item) => <li key={`${block.id}-${item.slice(0, 24)}`}>{item}</li>)}</ul>
            : <p key={block.id}>{block.text}</p>)}

          {formattedNote.reviewQuestions.length ? <div className="catalog-review-prompts"><h2>Review prompts</h2>{formattedNote.reviewQuestions.map((question, index) => <p key={question}><strong>{index + 1}.</strong> {question}</p>)}</div> : null}
        </div>
      </article>
    </div>
  );
}
