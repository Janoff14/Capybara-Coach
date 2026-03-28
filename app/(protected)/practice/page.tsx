"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Eye,
  EyeOff,
  Layers3,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
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
import { type FlashcardDeck, groupFlashcardsIntoDecks } from "@/lib/flashcards";

const TYPE_LABELS: Record<string, string> = {
  concept: "Concept",
  definition: "Definition",
  mistake: "Mistake repair",
  connection: "Connection",
};

export default function PracticePage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sessionIdParam = searchParams.get("sessionId");
  const [selectedSessionIdOverride, setSelectedSessionIdOverride] = useState<string | null>(null);

  const flashcardsQuery = useQuery({
    queryKey: ["flashcards"],
    enabled: Boolean(token),
    queryFn: () => api.getFlashcards(token!),
  });

  const sessionQuery = useQuery({
    queryKey: ["sessions", sessionIdParam],
    enabled: Boolean(token && sessionIdParam),
    queryFn: () => api.getSession(sessionIdParam!, token!),
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    enabled: Boolean(token),
    queryFn: () => api.getReviews(token!),
  });

  const generateDeckMutation = useMutation({
    mutationFn: async () => {
      if (!token || !sessionIdParam) {
        throw new Error("Open this page from an assessed session to generate a deck.");
      }

      return api.generateFlashcards(token, sessionIdParam);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      toast.success("Flashcard deck generated.");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not generate flashcards.";
      toast.error(message);
    },
  });

  const decks = useMemo(
    () => groupFlashcardsIntoDecks(flashcardsQuery.data ?? []),
    [flashcardsQuery.data],
  );
  const reviewMap = useMemo(
    () =>
      new Map((reviewsQuery.data ?? []).map((review) => [review.study_session_id, review])),
    [reviewsQuery.data],
  );
  const selectedSessionId =
    sessionIdParam ?? selectedSessionIdOverride ?? decks[0]?.sessionId ?? null;
  const selectedDeck =
    decks.find((deck) => deck.sessionId === selectedSessionId) ?? decks[0] ?? null;
  const hasRequestedSession = Boolean(sessionIdParam);
  const requestedDeckExists = Boolean(
    sessionIdParam && decks.some((deck) => deck.sessionId === sessionIdParam),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Practice"
        title="Flashcards for active review"
        description="Use these decks to retrieve the material from memory before you reveal the answer."
        actions={
          hasRequestedSession ? (
            <Button
              onClick={() => generateDeckMutation.mutate()}
              disabled={
                generateDeckMutation.isPending ||
                (requestedDeckExists && !sessionQuery.data?.assessment_json)
              }
            >
              {generateDeckMutation.isPending ? "Generating..." : requestedDeckExists ? "Regenerate deck" : "Generate deck"}
            </Button>
          ) : null
        }
      />

      {flashcardsQuery.isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-[var(--muted-foreground)]">
            Loading practice decks...
          </CardContent>
        </Card>
      ) : decks.length === 0 ? (
        <EmptyState
          title="No flashcards yet"
          description={
            hasRequestedSession
              ? "Generate a deck from this assessed session to start practice."
              : "Finish an assessed session, then generate a flashcard deck from the assessment page."
          }
          action={
            hasRequestedSession ? (
              <Button
                onClick={() => generateDeckMutation.mutate()}
                disabled={generateDeckMutation.isPending}
              >
                {generateDeckMutation.isPending ? "Generating..." : "Generate flashcards"}
              </Button>
            ) : (
              <Button asChild>
                <Link href="/documents">Go to documents</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="surface-grid xl:grid-cols-[0.78fr_1.22fr] xl:grid">
          <Card>
            <CardHeader>
              <CardTitle>Decks</CardTitle>
              <CardDescription>
                Pick a session deck and run through it like a short retrieval drill.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {decks.map((deck) => {
                const isActive = deck.sessionId === selectedDeck?.sessionId;
                return (
                  <button
                    key={deck.sessionId}
                    type="button"
                    onClick={() => setSelectedSessionIdOverride(deck.sessionId)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-[rgba(73,102,64,0.22)] bg-[rgba(73,102,64,0.08)]"
                        : "border-[var(--border-soft)] bg-[var(--panel-soft)] hover:bg-[rgba(73,102,64,0.04)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">{deck.documentTitle}</p>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          {deck.cards.length} card{deck.cards.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Layers3 className="size-4 text-[var(--primary)]" />
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                      Updated{" "}
                      {formatDistanceToNow(new Date(deck.updatedAt), { addSuffix: true })}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {!selectedDeck ? (
            <EmptyState
              title="This deck is empty"
              description="Generate the deck again if the session did not produce any cards."
            />
          ) : (
            <PracticeDeckPlayer
              key={selectedDeck.sessionId}
              deck={selectedDeck}
              review={reviewMap.get(selectedDeck.sessionId) ?? null}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PracticeDeckPlayer({
  deck,
  review,
}: {
  deck: FlashcardDeck;
  review: Awaited<ReturnType<typeof api.getReviews>>[number] | null;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const activeCard = deck.cards[cardIndex];
  const isLastCard = cardIndex === deck.cards.length - 1;

  const gradeReviewMutation = useMutation({
    mutationFn: async (rating: "easy" | "medium" | "hard") => {
      if (!token) {
        throw new Error("You need to be logged in to update review progress.");
      }

      return api.gradeReview(token, deck.sessionId, rating);
    },
    onSuccess: async (_, rating) => {
      await queryClient.invalidateQueries({ queryKey: ["reviews"] });
      toast.success(
        rating === "hard"
          ? "Review marked hard. We will bring it back sooner."
          : rating === "medium"
            ? "Review scheduled again."
            : "Review scheduled further out.",
      );
    },
    onError: (error) => {
      const message =
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not update the review schedule.";
      toast.error(message);
    },
  });

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-[linear-gradient(90deg,var(--primary),var(--primary-soft),var(--accent-warm))]" />
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{deck.documentTitle}</CardTitle>
              <CardDescription>
                Card {cardIndex + 1} of {deck.cards.length}
              </CardDescription>
            </div>
            <div className="rounded-full border border-[var(--border-soft)] bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              {TYPE_LABELS[activeCard.card_type] ?? "Flashcard"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Review cadence
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
                  {review
                    ? review.is_due
                      ? "Due now. Run through the deck, then grade how it felt."
                      : `Next review ${formatDistanceToNow(new Date(review.next_review_at), {
                          addSuffix: true,
                        })}.`
                    : "No spaced review schedule yet for this deck."}
                </p>
              </div>
              {review ? (
                <div className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  {review.last_rating ? `Last: ${review.last_rating}` : "First review"}
                </div>
              ) : null}
            </div>
            {review ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <CalendarClock className="size-3.5 text-[var(--primary)]" />
                Next review on {format(new Date(review.next_review_at), "PPP")}
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-[rgba(73,102,64,0.12)] bg-[linear-gradient(180deg,rgba(73,102,64,0.07),rgba(255,255,255,0.92))] p-6 shadow-[0_20px_40px_rgba(28,27,27,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Prompt
            </p>
            <p className="mt-4 font-display text-3xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
              {activeCard.question}
            </p>
            {activeCard.cue ? (
              <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
                Cue: {activeCard.cue}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <Button
              variant={showAnswer ? "secondary" : "default"}
              onClick={() => setShowAnswer((current) => !current)}
            >
              {showAnswer ? (
                <>
                  <EyeOff className="size-4" />
                  Hide answer
                </>
              ) : (
                <>
                  <Eye className="size-4" />
                  Reveal answer
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowAnswer(false);
                setCardIndex(0);
              }}
            >
              <RotateCcw className="size-4" />
              Restart deck
            </Button>
          </div>

          <div
            className={`rounded-[28px] border px-6 py-5 transition ${
              showAnswer
                ? "border-[rgba(73,102,64,0.18)] bg-[rgba(73,102,64,0.08)]"
                : "border-dashed border-[var(--border-soft)] bg-[var(--panel-soft)]"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Answer
            </p>
            {showAnswer ? (
              <p className="mt-4 text-[15px] leading-8 text-[var(--foreground)]">
                {activeCard.answer}
              </p>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
                Try answering out loud first, then reveal the answer to check yourself.
              </p>
            )}
            {activeCard.source_focus ? (
              <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Focus: {activeCard.source_focus}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="secondary"
          onClick={() => {
            setShowAnswer(false);
            setCardIndex((current) => Math.max(0, current - 1));
          }}
          disabled={cardIndex === 0}
        >
          <ArrowLeft className="size-4" />
          Previous
        </Button>
        <div className="h-2 w-full max-w-[16rem] rounded-full bg-[rgba(73,102,64,0.10)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--primary-soft))]"
            style={{
              width: `${((cardIndex + 1) / deck.cards.length) * 100}%`,
            }}
          />
        </div>
        <Button
          onClick={() => {
            setShowAnswer(false);
            setCardIndex((current) => Math.min(deck.cards.length - 1, current + 1));
          }}
          disabled={cardIndex >= deck.cards.length - 1}
        >
          Next
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {review && isLastCard && showAnswer ? (
        <Card>
          <CardHeader>
            <CardTitle>Grade this review</CardTitle>
            <CardDescription>
              Tell the scheduler how this deck felt so it can decide when to bring it back.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Button
              variant="secondary"
              onClick={() => gradeReviewMutation.mutate("hard")}
              disabled={gradeReviewMutation.isPending}
            >
              Hard
            </Button>
            <Button
              variant="secondary"
              onClick={() => gradeReviewMutation.mutate("medium")}
              disabled={gradeReviewMutation.isPending}
            >
              Medium
            </Button>
            <Button
              onClick={() => gradeReviewMutation.mutate("easy")}
              disabled={gradeReviewMutation.isPending}
            >
              Easy
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
