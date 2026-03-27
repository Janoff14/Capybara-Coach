"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export default function NotesPage() {
  const { token } = useAuth();

  const notesQuery = useQuery({
    queryKey: ["notes"],
    enabled: Boolean(token),
    queryFn: () => api.getNotes(token!),
  });

  const notes = notesQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Notes"
        title="Saved notes from completed recall sessions."
        description="These are the cleaned, structured outputs generated after your explanation was transcribed and assessed."
      />

      {notesQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-slate-300">
            Loading saved notes...
          </CardContent>
        </Card>
      ) : notesQuery.isError ? (
        <EmptyState
          title="We could not load your notes."
          description="Check the backend connection and try again."
        />
      ) : notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Finish a study session and generate notes from the assessment page to populate this list."
          action={
            <Button asChild>
              <Link href="/documents">Go to documents</Link>
            </Button>
          }
        />
      ) : (
        <div className="surface-grid md:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`} className="block">
              <Card className="h-full transition-transform hover:-translate-y-0.5">
                <CardHeader>
                  <CardTitle>{note.title}</CardTitle>
                  <CardDescription>
                    Saved {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="line-clamp-3 text-sm text-slate-300">
                    {note.summary}
                  </p>
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-cyan-300">
                    Open note
                    <ArrowRight className="size-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
