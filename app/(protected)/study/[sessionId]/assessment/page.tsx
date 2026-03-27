"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { SessionStatusBadge } from "@/components/app/session-status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";

export default function AssessmentPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();

  const sessionQuery = useQuery({
    queryKey: ["sessions", params.sessionId],
    enabled: Boolean(token && params.sessionId),
    queryFn: () => api.getSession(params.sessionId, token!),
  });

  const documentQuery = useQuery({
    queryKey: ["documents", sessionQuery.data?.document_id],
    enabled: Boolean(token && sessionQuery.data?.document_id),
    queryFn: () => api.getDocument(sessionQuery.data!.document_id, token!),
  });

  const generateNotesMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("You need to be logged in to generate notes.");
      }

      return api.generateNotes(token, params.sessionId);
    },
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await queryClient.invalidateQueries({
        queryKey: ["sessions", params.sessionId],
      });
      toast.success("Notes generated.");
      if (session.note) {
        router.push(`/notes/${session.note.id}`);
      }
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not generate notes.";
      toast.error(message);
    },
  });

  const session = sessionQuery.data;
  const assessment = session?.assessment_json;
  const document = documentQuery.data;
  const strengths = assessment?.strengths ?? [];
  const gaps = assessment?.gaps ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Assessment"
        title={document?.title ?? "Assessment results"}
        description="This screen compares your spoken explanation against the source material and shows what you covered well and what still needs work."
        actions={session ? <SessionStatusBadge status={session.status} /> : null}
      />

      {sessionQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-slate-300">
            Loading the assessed session...
          </CardContent>
        </Card>
      ) : !session || !assessment ? (
        <EmptyState
          title="Assessment is not ready yet"
          description="Upload a recording and let the app finish transcription and assessment before you open this page."
          action={
            <Button onClick={() => router.push(`/study/${params.sessionId}/record`)}>
              Back to recording
            </Button>
          }
        />
      ) : (
        <>
          <section className="surface-grid-3">
            <MetricCard
              label="Overall score"
              value={String(session.assessment_score ?? assessment.score)}
              hint="How well your explanation matched the source."
            />
            <MetricCard
              label="Accuracy"
              value={String(assessment.accuracy)}
              hint="Did you explain the material correctly?"
            />
            <MetricCard
              label="Coverage"
              value={String(assessment.coverage)}
              hint="How much of the source did you include?"
            />
          </section>

          <section className="surface-grid-3">
            <MetricCard
              label="Clarity"
              value={String(assessment.clarity)}
              hint="How clearly your explanation came across."
            />
            <MetricCard
              label="Examples"
              value={String(assessment.examples)}
              hint="Whether your explanation used concrete examples."
            />
            <Card>
              <CardHeader>
                <CardTitle>Next step</CardTitle>
                <CardDescription>
                  Turn the assessment into a cleaned-up note you can review later.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => generateNotesMutation.mutate()}
                  disabled={generateNotesMutation.isPending}
                >
                  {generateNotesMutation.isPending
                    ? "Generating notes..."
                    : "Generate notes"}
                </Button>
              </CardContent>
            </Card>
          </section>

          <div className="surface-grid xl:grid-cols-[1fr_1fr_1fr] xl:grid">
            <Card>
              <CardHeader>
                <CardTitle>Feedback</CardTitle>
                <CardDescription>
                  Summary commentary from the evaluator.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-slate-200">
                  {session.assessment_feedback ?? assessment.feedback}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Strengths</CardTitle>
                <CardDescription>
                  What the evaluator thought you did well.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {strengths.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    No specific strengths were returned.
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm leading-7 text-slate-200">
                    {strengths.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gaps</CardTitle>
                <CardDescription>
                  Areas to cover more completely next time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gaps.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    No major gaps were returned.
                  </p>
                ) : (
                  <ul className="space-y-3 text-sm leading-7 text-slate-200">
                    {gaps.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
