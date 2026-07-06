"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Layers3,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { OperationProgress } from "@/components/app/operation-progress";
import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { type FlashcardDeck, groupFlashcardsIntoDecks } from "@/lib/flashcards";
import type { PracticeAttemptRead, ReviewScheduleRead } from "@/lib/types";

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
  const [selectedSessionOverride, setSelectedSessionOverride] = useState<{
    routeSessionId: string | null;
    selectedSessionId: string;
  } | null>(null);
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
    onError: (error) => toast.error(errorMessage(error, "Could not generate flashcards.")),
  });

  const decks = useMemo(
    () => groupFlashcardsIntoDecks(flashcardsQuery.data ?? []),
    [flashcardsQuery.data],
  );
  const reviewMap = useMemo(
    () => new Map((reviewsQuery.data ?? []).map((review) => [review.study_session_id, review])),
    [reviewsQuery.data],
  );
  const selectedSessionId = selectedSessionOverride?.routeSessionId === sessionIdParam
    ? selectedSessionOverride.selectedSessionId
    : sessionIdParam ?? decks[0]?.sessionId ?? null;
  const selectedDeck = decks.find((deck) => deck.sessionId === selectedSessionId) ?? decks[0] ?? null;
  const requestedDeckExists = Boolean(
    sessionIdParam && decks.some((deck) => deck.sessionId === sessionIdParam),
  );

  return (
    <div className="catalog-practice">
      <section className="catalog-page-title has-tabs">
        <div>
          <p className="reader-overline">Drill drawer · written retrieval</p>
          <h1>Flashcards</h1>
          <p>Write every answer from memory. The deck is assessed only after every card is complete.</p>
        </div>
        <div className="catalog-folder-tabs">
          {decks.map((deck) => (
            <button
              key={deck.sessionId}
              type="button"
              className={deck.sessionId === selectedDeck?.sessionId ? "is-active" : ""}
              onClick={() => setSelectedSessionOverride({ routeSessionId: sessionIdParam, selectedSessionId: deck.sessionId })}
            >
              {deck.documentTitle} ({deck.cards.length})
            </button>
          ))}
        </div>
      </section>

      {sessionIdParam ? (
        <button
          type="button"
          className="catalog-regenerate"
          onClick={() => generateDeckMutation.mutate()}
          disabled={
            generateDeckMutation.isPending ||
            (requestedDeckExists && !sessionQuery.data?.assessment_json)
          }
        >
          {generateDeckMutation.isPending ? (
            <><LoaderCircle className="reader-spin" /> Generating…</>
          ) : requestedDeckExists ? "Regenerate deck" : "Generate deck"}
        </button>
      ) : null}
      {generateDeckMutation.isPending ? (
        <OperationProgress
          label="Generating flashcards"
          detail="Comparing the session assessment with your source material."
        />
      ) : null}

      {flashcardsQuery.isError || reviewsQuery.isError || sessionQuery.isError ? (
        <div className="catalog-notice is-error">The practice drawer could not be fully loaded. Check the study service and try again.</div>
      ) : null}

      {flashcardsQuery.isLoading ? (
        <div className="catalog-empty-card">
          <OperationProgress label="Shuffling the decks" detail="Loading flashcards and their review schedules." />
        </div>
      ) : flashcardsQuery.isError ? null : decks.length === 0 ? (
        <div className="catalog-empty-card">
          <Layers3 />
          <h3>No flashcards punched yet.</h3>
          <p>Finish an assessed session and generate a deck.</p>
          {sessionIdParam ? (
            <button type="button" onClick={() => generateDeckMutation.mutate()}>
              Generate flashcards
            </button>
          ) : (
            <Link href="/documents">Go to documents →</Link>
          )}
        </div>
      ) : selectedDeck ? (
        <PracticeDeckPlayer
          key={selectedDeck.sessionId}
          deck={selectedDeck}
          review={reviewMap.get(selectedDeck.sessionId) ?? null}
        />
      ) : null}
    </div>
  );
}

function PracticeDeckPlayer({
  deck,
  review,
}: {
  deck: FlashcardDeck;
  review: ReviewScheduleRead | null;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [cardIndex, setCardIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cardSeconds, setCardSeconds] = useState<Record<string, number>>({});
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [result, setResult] = useState<PracticeAttemptRead | null>(null);
  const activeCard = deck.cards[cardIndex];
  const answeredCount = deck.cards.filter((card) => answers[card.id]?.trim()).length;
  const allAnswered = answeredCount === deck.cards.length;

  const attemptMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("You need to be logged in.");
      return api.assessPracticeAttempt(token, deck.sessionId, {
        answers: deck.cards.map((card) => ({
          flashcard_id: card.id,
          answer: answers[card.id]?.trim() ?? "",
          elapsed_seconds: cardSeconds[card.id] ?? 0,
        })),
        active_seconds: activeSeconds,
        paused_seconds: pausedSeconds,
      });
    },
    onSuccess: (attempt) => {
      setResult(attempt);
      setIsPaused(true);
      queryClient.setQueryData<ReviewScheduleRead[]>(["reviews"], (reviews) => {
        if (!reviews) return [attempt.schedule];
        const exists = reviews.some((item) => item.study_session_id === deck.sessionId);
        return exists
          ? reviews.map((item) =>
              item.study_session_id === deck.sessionId ? attempt.schedule : item,
            )
          : [...reviews, attempt.schedule];
      });
      toast.success("Written attempt assessed and review schedule updated.");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not assess this attempt.")),
  });

  useEffect(() => {
    if (!hasStarted || result || attemptMutation.isPending) return;
    const intervalId = window.setInterval(() => {
      if (isPaused) {
        setPausedSeconds((seconds) => seconds + 1);
        return;
      }
      setActiveSeconds((seconds) => seconds + 1);
      setCardSeconds((seconds) => ({
        ...seconds,
        [activeCard.id]: (seconds[activeCard.id] ?? 0) + 1,
      }));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeCard.id, attemptMutation.isPending, hasStarted, isPaused, result]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && hasStarted && !result && !attemptMutation.isPending) setIsPaused(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [attemptMutation.isPending, hasStarted, result]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        !hasStarted ||
        isPaused ||
        result ||
        attemptMutation.isPending
      ) return;
      if (event.key === "ArrowRight") {
        setCardIndex((current) => Math.min(deck.cards.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft") {
        setCardIndex((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attemptMutation.isPending, deck.cards.length, hasStarted, isPaused, result]);

  const go = (direction: number) => {
    setCardIndex((current) =>
      Math.max(0, Math.min(deck.cards.length - 1, current + direction)),
    );
  };

  const restart = () => {
    setCardIndex(0);
    setAnswers({});
    setCardSeconds({});
    setActiveSeconds(0);
    setPausedSeconds(0);
    setHasStarted(false);
    setIsPaused(true);
    setResult(null);
    attemptMutation.reset();
  };

  return (
    <section className="catalog-practice-layout catalog-written-practice">
      <div>
        <div className="catalog-card-meta">
          <span>{deck.documentTitle} · card {cardIndex + 1} of {deck.cards.length}</span>
          <em>{TYPE_LABELS[activeCard.card_type] ?? "Flashcard"}</em>
        </div>

        <article className={`catalog-written-card${isPaused ? " is-paused" : ""}`}>
          <div className="catalog-written-prompt">
            <span>Prompt</span>
            <h2>{activeCard.question}</h2>
            <p>{activeCard.cue ? `Cue: ${activeCard.cue}` : "Recall the idea in your own words."}</p>
          </div>
          <label htmlFor={`answer-${activeCard.id}`}>Your written answer</label>
          <textarea
            id={`answer-${activeCard.id}`}
            value={answers[activeCard.id] ?? ""}
            onChange={(event) => setAnswers((current) => ({
              ...current,
              [activeCard.id]: event.target.value,
            }))}
            rows={7}
            maxLength={6000}
            disabled={!hasStarted || isPaused || attemptMutation.isPending}
            placeholder="Explain it from memory. Aim for accurate, complete, and concise."
          />
          <footer>
            <span>{answers[activeCard.id]?.length ?? 0} / 6000</span>
            <span><Clock3 aria-hidden="true" /> {formatDuration(cardSeconds[activeCard.id] ?? 0)} on this card</span>
          </footer>
          {!hasStarted || isPaused ? (
            <div className="catalog-practice-paused">
              {hasStarted ? <Pause aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
              <strong>{hasStarted ? "Practice paused" : "Ready when you are"}</strong>
              <span>{hasStarted ? "Your active time is frozen." : "The clock starts only when you choose to begin."}</span>
              <button
                type="button"
                onClick={() => {
                  setHasStarted(true);
                  setIsPaused(false);
                }}
              >
                <Play aria-hidden="true" /> {hasStarted ? "Resume attempt" : "Start timed attempt"}
              </button>
            </div>
          ) : null}
        </article>

        <div className="catalog-card-nav">
          <button type="button" onClick={() => go(-1)} disabled={cardIndex === 0 || !hasStarted || isPaused}>
            <ArrowLeft /> Prev
          </button>
          <div>
            {deck.cards.map((card, index) => (
              <button
                key={card.id}
                type="button"
                className={index === cardIndex ? "is-current" : answers[card.id]?.trim() ? "is-graded" : ""}
                onClick={() => setCardIndex(index)}
                disabled={!hasStarted || isPaused}
                aria-label={`Open card ${index + 1}${answers[card.id]?.trim() ? ", answered" : ""}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={cardIndex === deck.cards.length - 1 || !hasStarted || isPaused}
          >
            Next <ArrowRight />
          </button>
        </div>

        <article className="catalog-attempt-submit">
          <div>
            <span>{answeredCount} of {deck.cards.length} answered</span>
            <strong>{allAnswered ? "Ready for assessment" : "Complete every card to finish"}</strong>
          </div>
          <div className="catalog-attempt-completion" aria-hidden="true">
            <i style={{ width: `${(answeredCount / deck.cards.length) * 100}%` }} />
          </div>
          <button
            type="button"
            onClick={() => attemptMutation.mutate()}
            disabled={!hasStarted || !allAnswered || isPaused || attemptMutation.isPending}
          >
            <Send aria-hidden="true" /> Assess complete attempt
          </button>
          {attemptMutation.isPending ? (
            <OperationProgress
              compact
              label="Assessing your written recall"
              detail="Comparing accuracy, completeness, concision, and active time across the full deck."
            />
          ) : null}
        </article>
      </div>

      <aside>
        <article className="catalog-review-card">
          <header><h2>Review card</h2><span>AI scheduled</span></header>
          <p><span>Due</span><strong>{review?.is_due ? "now" : review ? formatDistanceToNow(new Date(review.next_review_at), { addSuffix: true }) : "after this attempt"}</strong></p>
          <p><span>Answered</span><strong>{answeredCount} / {deck.cards.length}</strong></p>
          <p><span>Last rating</span><strong>{review?.last_rating ?? "—"}</strong></p>
        </article>
        <article className="catalog-practice-clock">
          <span className="reader-overline">Attempt clock</span>
          <strong>{formatDuration(activeSeconds)}</strong>
          <p>Active time · {formatDuration(pausedSeconds)} paused</p>
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            disabled={!hasStarted || attemptMutation.isPending || Boolean(result)}
          >
            {isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {isPaused ? "Resume attempt" : "Pause attempt"}
          </button>
        </article>
        <article className="catalog-keyboard-card">
          <span className="reader-overline">Keyboard</span>
          <p>← / → — previous · next</p>
          <p>Answers stay saved while you move.</p>
        </article>
        <button type="button" className="catalog-restart" onClick={restart}>
          <RotateCcw /> Restart attempt
        </button>
      </aside>

      {result ? (
        <AttemptResult result={result} deck={deck} answers={answers} onRestart={restart} />
      ) : null}
    </section>
  );
}

function AttemptResult({
  result,
  deck,
  answers,
  onRestart,
}: {
  result: PracticeAttemptRead;
  deck: FlashcardDeck;
  answers: Record<string, string>;
  onRestart: () => void;
}) {
  return (
    <div className="catalog-attempt-backdrop" role="dialog" aria-modal="true" aria-labelledby="attempt-result-title">
      <article className="catalog-attempt-result">
        <header>
          <div>
            <span>AI assessment · {result.rating}</span>
            <h2 id="attempt-result-title">Attempt complete</h2>
            <p>{result.assessment.summary}</p>
          </div>
          <strong>{result.score}<small>/100</small></strong>
        </header>
        <div className="catalog-attempt-findings">
          <section><h3>What held up</h3><ul>{result.assessment.strengths.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><h3>Sharpen next</h3><ul>{result.assessment.improvements.map((item) => <li key={item}>{item}</li>)}</ul></section>
        </div>
        <div className="catalog-attempt-card-results">
          {deck.cards.map((card, index) => {
            const finding = result.assessment.per_card.find((item) => item.flashcard_id === card.id);
            return (
              <details key={card.id}>
                <summary>
                  <span>{index + 1}. {card.question}</span>
                  <strong>{finding?.score ?? 0}/100</strong>
                </summary>
                <div>
                  <p><b>Your answer</b>{answers[card.id]}</p>
                  <p><b>Reference</b>{card.answer}</p>
                  <p><b>Assessment</b>{finding?.feedback ?? "Review this answer against the reference."}</p>
                </div>
              </details>
            );
          })}
        </div>
        <footer>
          <span><CheckCircle2 aria-hidden="true" /> Next review in {result.schedule.current_interval_days} day{result.schedule.current_interval_days === 1 ? "" : "s"}</span>
          <div><button type="button" onClick={onRestart}>Practice again</button><Link href="/dashboard">Back to desk</Link></div>
        </footer>
      </article>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}
