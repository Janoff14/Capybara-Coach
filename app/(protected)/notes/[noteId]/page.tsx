"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { NoteRichContent } from "@/components/app/note-rich-content";
import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNote } from "@/lib/note-format";
import { api } from "@/lib/api";

export default function NoteDetailPage() {
  const params = useParams<{ noteId: string }>();
  const { token } = useAuth();

  const noteQuery = useQuery({
    queryKey: ["notes", params.noteId],
    enabled: Boolean(token && params.noteId),
    queryFn: () => api.getNote(params.noteId, token!),
  });

  const note = noteQuery.data;
  const formattedNote = note ? formatNote(note) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Note detail"
        title={note?.title ?? "Loading note"}
        description="Review the cleaned summary and final note body generated from your assessed explanation."
      />

      {noteQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-[var(--muted-foreground)]">
            Loading note detail...
          </CardContent>
        </Card>
      ) : noteQuery.isError || !note ? (
        <EmptyState
          title="This note could not be loaded"
          description="It may have been removed, or the backend request may have failed."
        />
      ) : (
        <div className="surface-grid xl:grid-cols-[0.88fr_1.42fr] xl:grid">
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="h-1.5 bg-[linear-gradient(90deg,var(--primary),var(--primary-soft),var(--accent-warm))]" />
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>
                  Saved on {format(new Date(note.created_at), "PPP 'at' p")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-[15px] leading-8 text-[var(--muted-foreground)]">
                  {note.summary}
                </p>
              </CardContent>
            </Card>

            {formattedNote && formattedNote.takeaways.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>At a Glance</CardTitle>
                  <CardDescription>
                    The fastest way to skim the important ideas before you dive into the full note.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {formattedNote.takeaways.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 rounded-[16px] border border-[rgba(194,200,190,0.35)] bg-[rgba(133,165,121,0.08)] px-4 py-3 text-sm leading-7 text-[var(--muted-foreground)]"
                      >
                        <CheckCircle2 className="mt-1 size-4 shrink-0 text-[var(--primary)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {formattedNote && formattedNote.reviewQuestions.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Review Prompts</CardTitle>
                  <CardDescription>
                    Use these to test recall instead of rereading passively.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {formattedNote.reviewQuestions.map((question, index) => (
                    <div
                      key={question}
                      className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                        Prompt {index + 1}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                        {question}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <Card className="overflow-hidden">
            <div className="h-1.5 bg-[linear-gradient(90deg,rgba(245,212,140,0.75),rgba(133,165,121,0.45),rgba(73,102,64,0.75))]" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[rgba(73,102,64,0.12)] p-2 text-[var(--primary)]">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <CardTitle>Full Note</CardTitle>
                  <CardDescription>
                    Reformatted for scanning, review, and easier studying.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <NoteRichContent note={note} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
