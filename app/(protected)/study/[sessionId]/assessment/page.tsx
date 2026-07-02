"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Target,
  PanelsTopLeft,
} from "lucide-react";
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
import type { AssessmentJson } from "@/lib/types";

const CRITERIA_ORDER = [
  {
    key: "coverage",
    label: "Coverage",
    hint: "Did you bring in the important ideas?",
  },
  {
    key: "accuracy",
    label: "Accuracy",
    hint: "Were the facts and relationships correct?",
  },
  {
    key: "clarity",
    label: "Clarity",
    hint: "Could someone follow the explanation easily?",
  },
  {
    key: "structure",
    label: "Structure",
    hint: "Did the explanation unfold in a coherent order?",
  },
  {
    key: "depth",
    label: "Depth",
    hint: "Did you go beyond surface-level recall?",
  },
] as const;

type AssessmentCriteriaKey = (typeof CRITERIA_ORDER)[number]["key"];

function clampStrictness(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getStrictnessProfile(strictness: number) {
  if (strictness <= 33) {
    return {
      label: "Supportive",
      description: "Rewards rough but correct understanding and gives you more room to think aloud.",
    };
  }

  if (strictness <= 66) {
    return {
      label: "Balanced",
      description: "Pushes for the key ideas while still allowing natural, imperfect delivery.",
    };
  }

  return {
    label: "Demanding",
    description: "Expects precision, cleaner structure, and fewer missing details.",
  };
}

function getScoreMood(score: number) {
  if (score >= 85) {
    return "Strong recall";
  }

  if (score >= 65) {
    return "Promising, but uneven";
  }

  return "Needs another pass";
}

function deriveCriteria(assessment: AssessmentJson) {
  return {
    coverage: assessment.criteria?.coverage ?? assessment.coverage ?? 0,
    accuracy: assessment.criteria?.accuracy ?? assessment.accuracy ?? 0,
    clarity: assessment.criteria?.clarity ?? assessment.clarity ?? 0,
    structure: assessment.criteria?.structure ?? assessment.structure ?? 0,
    depth: assessment.criteria?.depth ?? assessment.depth ?? assessment.examples ?? 0,
  };
}

function deriveList(
  preferred: string[] | undefined,
  fallback: string[] | undefined,
) {
  return preferred && preferred.length > 0 ? preferred : fallback ?? [];
}

function scoreBarClass(score: number) {
  if (score >= 85) {
    return "bg-[linear-gradient(90deg,rgba(73,102,64,0.92),rgba(118,158,107,0.88))]";
  }

  if (score >= 65) {
    return "bg-[linear-gradient(90deg,rgba(93,104,54,0.92),rgba(177,160,94,0.85))]";
  }

  return "bg-[linear-gradient(90deg,rgba(146,79,72,0.92),rgba(211,137,126,0.85))]";
}

function BreakdownCard({
  icon,
  title,
  description,
  items,
  emptyMessage,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2 text-[var(--foreground)]">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm leading-7 text-[var(--muted-foreground)]">{emptyMessage}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-3 text-sm leading-7 text-[var(--muted-foreground)]"
              >
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function AssessmentPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token } = useAuth();
  const [strictnessOverride, setStrictnessOverride] = useState<number | null>(null);

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

  const sourceNoteQuery = useQuery({
    queryKey: ["notes", sessionQuery.data?.source_note_id],
    enabled: Boolean(token && sessionQuery.data?.source_note_id),
    queryFn: () => api.getNote(sessionQuery.data!.source_note_id!, token!),
  });

  const rerunAssessmentMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("You need to be logged in to reassess this session.");
      }

      return api.assessSession(token, params.sessionId, strictness);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await queryClient.invalidateQueries({
        queryKey: ["sessions", params.sessionId],
      });
      toast.success("Assessment updated.");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not refresh the assessment.";
      toast.error(message);
    },
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

  const flashcardsQuery = useQuery({
    queryKey: ["flashcards", params.sessionId],
    enabled: Boolean(token && params.sessionId && !sessionQuery.data?.source_note_id),
    queryFn: () => api.getFlashcards(token!, params.sessionId),
  });

  const generateFlashcardsMutation = useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("You need to be logged in to generate flashcards.");
      }

      return api.generateFlashcards(token, params.sessionId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      await queryClient.invalidateQueries({ queryKey: ["flashcards", params.sessionId] });
      toast.success("Flashcards generated.");
      router.push(`/practice?sessionId=${params.sessionId}`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not generate flashcards.";
      toast.error(message);
    },
  });

  const session = sessionQuery.data;
  const assessment = session?.assessment_json;
  const document = documentQuery.data;
  const sourceNote = sourceNoteQuery.data;
  const isNoteRecall = Boolean(session?.source_note_id);

  const criteria = useMemo(
    () => (assessment ? deriveCriteria(assessment) : null),
    [assessment],
  );
  const coveredWell = useMemo(
    () => deriveList(assessment?.covered_well, assessment?.strengths),
    [assessment],
  );
  const missing = useMemo(
    () => deriveList(assessment?.missing, assessment?.gaps),
    [assessment],
  );
  const weakAreas = assessment?.weak_areas ?? [];
  const nextSteps = assessment?.next_steps ?? [];
  const appliedStrictness = clampStrictness(assessment?.strictness ?? 50);
  const strictness = strictnessOverride ?? appliedStrictness;
  const strictnessProfile = getStrictnessProfile(strictness);
  const canOpenNotes = Boolean(session?.note);
  const hasFlashcards = (flashcardsQuery.data?.length ?? 0) > 0;
  const hasStrictnessChanged = strictness !== appliedStrictness;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Assessment"
        title={sourceNote?.title ?? document?.title ?? "Assessment results"}
        description={
          isNoteRecall
            ? "This review compares your retelling with the selected note. It gives feedback only and leaves the original note and its flashcards unchanged."
            : "This review checks what you covered, what you missed, and how clearly your explanation held together."
        }
        actions={session ? <SessionStatusBadge status={session.status} /> : null}
      />

      {sessionQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-[var(--muted-foreground)]">
            Loading the assessed session...
          </CardContent>
        </Card>
      ) : !session || !assessment || !criteria ? (
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
          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_0.8fr]">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(135deg,rgba(73,102,64,0.12),rgba(255,255,255,0.3))] px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                    Overall score
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="font-display text-7xl font-bold tracking-[-0.07em] text-[var(--foreground)]">
                        {assessment.score}
                      </p>
                      <p className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        {getScoreMood(assessment.score)}
                      </p>
                    </div>
                    <div className="rounded-full border border-[var(--border-soft)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Strictness {appliedStrictness}
                    </div>
                  </div>
                  <p className="mt-4 max-w-xl text-base leading-8 text-[var(--muted-foreground)]">
                    {assessment.verdict || session.assessment_feedback || assessment.feedback}
                  </p>
                </div>
                <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
                  <MetricCard
                    label="Coverage"
                    value={String(criteria.coverage)}
                    hint="How much of the important material made it into your recall."
                  />
                  <MetricCard
                    label="Accuracy"
                    value={String(criteria.accuracy)}
                    hint="Whether the details and relationships stayed correct."
                  />
                  <MetricCard
                    label="Depth"
                    value={String(criteria.depth)}
                    hint="Whether you moved beyond a surface-level summary."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <SlidersHorizontal className="size-4 text-[var(--primary)]" />
                  <CardTitle>Strictness</CardTitle>
                </div>
                <CardDescription>
                  Change how demanding the evaluator is, then rerun the assessment on the same transcript.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        Current lens
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                        {strictnessProfile.label}
                      </p>
                    </div>
                    <div className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
                      {strictness}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={strictness}
                    onChange={(event) =>
                      setStrictnessOverride(clampStrictness(Number(event.target.value)))
                    }
                    className="mt-5 h-2 w-full cursor-pointer appearance-none rounded-full bg-[rgba(73,102,64,0.12)] accent-[var(--primary)]"
                  />
                  <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    <span>Supportive</span>
                    <span>Balanced</span>
                    <span>Demanding</span>
                  </div>
                </div>

                <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                  {strictnessProfile.description}
                </p>

                <Button
                  className="w-full"
                  variant={hasStrictnessChanged ? "default" : "secondary"}
                  onClick={() => rerunAssessmentMutation.mutate()}
                  disabled={rerunAssessmentMutation.isPending || !hasStrictnessChanged}
                >
                  <RefreshCw className={rerunAssessmentMutation.isPending ? "size-4 animate-spin" : "size-4"} />
                  {rerunAssessmentMutation.isPending
                    ? "Reassessing..."
                    : hasStrictnessChanged
                      ? "Apply strictness and reassess"
                      : "Current strictness already applied"}
                </Button>
              </CardContent>
            </Card>

            {isNoteRecall ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 text-[var(--foreground)]">
                    <CheckCircle2 className="size-4 text-[var(--primary)]" />
                    <CardTitle>Recall complete</CardTitle>
                  </div>
                  <CardDescription>
                    This session ends with feedback. Your source note and existing cards stay exactly as they were.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Assessment only
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                      No new note or flashcard deck was created from this retelling.
                    </p>
                  </div>
                  {sourceNote ? (
                    <Button
                      className="w-full"
                      onClick={() => router.push(`/notes/${sourceNote.id}`)}
                    >
                      Back to source note
                    </Button>
                  ) : null}
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => router.push(`/study/${params.sessionId}/record`)}
                  >
                    Try another retelling
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 text-[var(--foreground)]">
                    <Sparkles className="size-4 text-[var(--primary)]" />
                    <CardTitle>Next step</CardTitle>
                  </div>
                  <CardDescription>
                    Turn this feedback into polished notes you can revisit later.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                      Notes flow
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                      The note generator uses this transcript, the source text, and the current assessment lens.
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => generateNotesMutation.mutate()}
                    disabled={generateNotesMutation.isPending}
                  >
                    {generateNotesMutation.isPending ? "Generating notes..." : "Generate notes"}
                  </Button>
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() =>
                      hasFlashcards
                        ? router.push(`/practice?sessionId=${params.sessionId}`)
                        : generateFlashcardsMutation.mutate()
                    }
                    disabled={generateFlashcardsMutation.isPending}
                  >
                    <PanelsTopLeft className="size-4" />
                    {generateFlashcardsMutation.isPending
                      ? "Building flashcards..."
                      : hasFlashcards
                        ? "Open practice deck"
                        : "Generate flashcards"}
                  </Button>
                  {canOpenNotes ? (
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => router.push(`/notes/${session.note!.id}`)}
                    >
                      Open latest note
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {CRITERIA_ORDER.map((criterion) => {
              const value = criteria[criterion.key as AssessmentCriteriaKey];
              return (
                <Card key={criterion.key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{criterion.label}</CardTitle>
                    <CardDescription>{criterion.hint}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between gap-3">
                      <p className="font-display text-4xl font-bold tracking-[-0.05em] text-[var(--foreground)]">
                        {value}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                        / 100
                      </p>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-[rgba(73,102,64,0.10)]">
                      <div
                        className={`h-full rounded-full ${scoreBarClass(value)}`}
                        style={{ width: `${Math.max(6, value)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <BreakdownCard
              icon={<CheckCircle2 className="size-4 text-[var(--primary)]" />}
              title="Covered well"
              description="These are the points you landed cleanly."
              items={coveredWell}
              emptyMessage="No standout strengths were returned yet."
            />
            <BreakdownCard
              icon={<AlertTriangle className="size-4 text-[hsl(17_72%_44%)]" />}
              title="Missing"
              description="Important ideas that still need to show up in your explanation."
              items={missing}
              emptyMessage="No clear missing concepts were flagged."
            />
            <BreakdownCard
              icon={<CircleDot className="size-4 text-[hsl(43_70%_42%)]" />}
              title="Weak areas"
              description="Parts that were present, but not strong or precise enough yet."
              items={weakAreas}
              emptyMessage="No weak-but-present areas were singled out."
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Evaluator note</CardTitle>
                <CardDescription>
                  A concise read on how this explanation came across.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4">
                  <p className="text-sm leading-8 text-[var(--muted-foreground)]">
                    {session.assessment_feedback ?? assessment.feedback}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-[var(--foreground)]">
                  <Target className="size-4 text-[var(--primary)]" />
                  <CardTitle>Next focus</CardTitle>
                </div>
                <CardDescription>
                  A tighter checklist for the next recall attempt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nextSteps.length === 0 ? (
                  <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                    No next-step checklist was returned. Rerunning the assessment can usually fill this in.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {nextSteps.map((step) => (
                      <li
                        key={step}
                        className="flex gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-3 text-sm leading-7 text-[var(--muted-foreground)]"
                      >
                        <ChevronRight className="mt-1 size-4 shrink-0 text-[var(--primary)]" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
