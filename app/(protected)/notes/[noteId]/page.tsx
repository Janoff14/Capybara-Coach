"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Note detail"
        title={note?.title ?? "Loading note"}
        description="Review the cleaned summary and final note body generated from your assessed explanation."
      />

      {noteQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-slate-300">
            Loading note detail...
          </CardContent>
        </Card>
      ) : noteQuery.isError || !note ? (
        <EmptyState
          title="This note could not be loaded"
          description="It may have been removed, or the backend request may have failed."
        />
      ) : (
        <div className="surface-grid xl:grid-cols-[0.9fr_1.4fr] xl:grid">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                Saved on {format(new Date(note.created_at), "PPP 'at' p")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-slate-200">{note.summary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full note</CardTitle>
              <CardDescription>
                This is the final readable output from the study session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm leading-8 text-slate-100">
                {note.content}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
