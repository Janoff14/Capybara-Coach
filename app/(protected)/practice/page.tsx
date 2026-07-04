"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ArrowRight, Layers3, LoaderCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { api, ApiError } from "@/lib/api";
import { type FlashcardDeck, groupFlashcardsIntoDecks } from "@/lib/flashcards";

const TYPE_LABELS: Record<string, string> = { concept: "Concept", definition: "Definition", mistake: "Mistake repair", connection: "Connection" };

export default function PracticePage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sessionIdParam = searchParams.get("sessionId");
  const [selectedSessionIdOverride, setSelectedSessionIdOverride] = useState<string | null>(null);
  const flashcardsQuery = useQuery({ queryKey: ["flashcards"], enabled: Boolean(token), queryFn: () => api.getFlashcards(token!) });
  const sessionQuery = useQuery({ queryKey: ["sessions", sessionIdParam], enabled: Boolean(token && sessionIdParam), queryFn: () => api.getSession(sessionIdParam!, token!) });
  const reviewsQuery = useQuery({ queryKey: ["reviews"], enabled: Boolean(token), queryFn: () => api.getReviews(token!) });

  const generateDeckMutation = useMutation({
    mutationFn: async () => {
      if (!token || !sessionIdParam) throw new Error("Open this page from an assessed session to generate a deck.");
      return api.generateFlashcards(token, sessionIdParam);
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["flashcards"] }); toast.success("Flashcard deck generated."); },
    onError: (error) => toast.error(error instanceof ApiError || error instanceof Error ? error.message : "Could not generate flashcards."),
  });

  const decks = useMemo(() => groupFlashcardsIntoDecks(flashcardsQuery.data ?? []), [flashcardsQuery.data]);
  const reviewMap = useMemo(() => new Map((reviewsQuery.data ?? []).map((review) => [review.study_session_id, review])), [reviewsQuery.data]);
  const selectedSessionId = sessionIdParam ?? selectedSessionIdOverride ?? decks[0]?.sessionId ?? null;
  const selectedDeck = decks.find((deck) => deck.sessionId === selectedSessionId) ?? decks[0] ?? null;
  const requestedDeckExists = Boolean(sessionIdParam && decks.some((deck) => deck.sessionId === sessionIdParam));

  return (
    <div className="catalog-practice">
      <section className="catalog-page-title has-tabs">
        <div><p className="reader-overline">Drill drawer · retrieval practice</p><h1>Flashcards</h1><p>Answer out loud first. Then flip. No cheating—the librarian can see you.</p></div>
        <div className="catalog-folder-tabs">
          {decks.map((deck) => <button key={deck.sessionId} type="button" className={deck.sessionId === selectedDeck?.sessionId ? "is-active" : ""} onClick={() => setSelectedSessionIdOverride(deck.sessionId)}>{deck.documentTitle} ({deck.cards.length})</button>)}
        </div>
      </section>

      {sessionIdParam ? <button type="button" className="catalog-regenerate" onClick={() => generateDeckMutation.mutate()} disabled={generateDeckMutation.isPending || (requestedDeckExists && !sessionQuery.data?.assessment_json)}>
        {generateDeckMutation.isPending ? <><LoaderCircle className="reader-spin" /> Generating…</> : requestedDeckExists ? "Regenerate deck" : "Generate deck"}
      </button> : null}

      {flashcardsQuery.isLoading ? <div className="catalog-empty-card"><LoaderCircle className="reader-spin" /><h3>Shuffling the decks…</h3></div>
        : decks.length === 0 ? <div className="catalog-empty-card"><Layers3 /><h3>No flashcards punched yet.</h3><p>Finish an assessed session and generate a deck.</p>{sessionIdParam ? <button type="button" onClick={() => generateDeckMutation.mutate()}>Generate flashcards</button> : <Link href="/documents">Go to documents →</Link>}</div>
          : selectedDeck ? <PracticeDeckPlayer key={selectedDeck.sessionId} deck={selectedDeck} review={reviewMap.get(selectedDeck.sessionId) ?? null} /> : null}
    </div>
  );
}

function PracticeDeckPlayer({ deck, review }: { deck: FlashcardDeck; review: Awaited<ReturnType<typeof api.getReviews>>[number] | null }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [graded, setGraded] = useState<Record<number, string>>({});
  const [cleared, setCleared] = useState(false);
  const activeCard = deck.cards[cardIndex];
  const isLastCard = cardIndex === deck.cards.length - 1;

  const ensureReviewScheduleMutation = useMutation({
    mutationFn: async () => { if (!token) throw new Error("You need to be logged in."); return api.generateFlashcards(token, deck.sessionId); },
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["flashcards"] }), queryClient.invalidateQueries({ queryKey: ["reviews"] })]); toast.success("Review scheduling is active."); },
    onError: (error) => toast.error(error instanceof ApiError || error instanceof Error ? error.message : "Could not enable review scheduling."),
  });
  const gradeReviewMutation = useMutation({
    mutationFn: async (rating: "easy" | "medium" | "hard") => { if (!token) throw new Error("You need to be logged in."); return api.gradeReview(token, deck.sessionId, rating); },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["reviews"] }); setCleared(true); },
    onError: (error) => toast.error(error instanceof ApiError || error instanceof Error ? error.message : "Could not update the review schedule."),
  });

  const go = (direction: number) => {
    setShowAnswer(false);
    setCardIndex((current) => (current + direction + deck.cards.length) % deck.cards.length);
  };
  const gradeCard = (label: string) => {
    setGraded((current) => ({ ...current, [cardIndex]: label }));
    if (!isLastCard) go(1);
  };
  const restart = () => { setCardIndex(0); setShowAnswer(false); setGraded({}); setCleared(false); };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === "Space") { event.preventDefault(); setShowAnswer((value) => !value); }
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <section className="catalog-practice-layout">
      <div>
        <div className="catalog-card-meta"><span>{deck.documentTitle} · card {cardIndex + 1} of {deck.cards.length}</span><em>{TYPE_LABELS[activeCard.card_type] ?? "Flashcard"}</em></div>
        <button type="button" className={`catalog-flashcard${showAnswer ? " is-flipped" : ""}`} onClick={() => setShowAnswer((value) => !value)} aria-label={showAnswer ? "Show prompt" : "Show answer"}>
          <div className="catalog-flashcard-front"><span>Prompt</span><strong>{activeCard.question}</strong><p>{activeCard.cue ? `Cue: ${activeCard.cue}` : "Say it from memory."}</p><small>Click or press Space to flip ↻</small></div>
          <div className="catalog-flashcard-back"><span>Answer</span><strong>{activeCard.answer}</strong><small>How well did you know it?</small></div>
        </button>

        {showAnswer ? <div className="catalog-grade-row">
          {[{label:"Again",sub:"<1 min",tone:"stamp"},{label:"Hard",sub:"~6 min",tone:"amber"},{label:"Good",sub:"1 day",tone:"green"},{label:"Easy",sub:"4 days",tone:"green2"}].map((grade) => <button key={grade.label} type="button" className={`is-${grade.tone}`} onClick={() => gradeCard(grade.label)}><strong>{grade.label}</strong><span>{grade.sub}</span></button>)}
        </div> : <div className="catalog-flip-hint">Say your answer out loud, then flip the card to grade yourself.</div>}

        <div className="catalog-card-nav"><button type="button" onClick={() => go(-1)}><ArrowLeft /> Prev</button><div>{deck.cards.map((_, index) => <i key={index} className={index === cardIndex ? "is-current" : graded[index] ? "is-graded" : ""} />)}</div><button type="button" onClick={() => go(1)}>Next <ArrowRight /></button></div>
      </div>

      <aside>
        <article className="catalog-review-card"><header><h2>Review card</h2><span>SM-2</span></header><p><span>Due</span><strong>{review?.is_due ? "now" : review ? formatDistanceToNow(new Date(review.next_review_at), { addSuffix: true }) : "not scheduled"}</strong></p><p><span>Graded this run</span><strong>{Object.keys(graded).length} / {deck.cards.length}</strong></p><p><span>Last rating</span><strong>{review?.last_rating ?? "—"}</strong></p></article>
        <article className="catalog-keyboard-card"><span className="reader-overline">Keyboard</span><p>Space — flip card</p><p>← / → — prev · next</p></article>
        <button type="button" className="catalog-restart" onClick={restart}><RotateCcw /> Restart deck</button>
        {isLastCard && showAnswer ? <article className="catalog-finish-deck"><h2>Finish this deck</h2>{review ? <div><button type="button" onClick={() => gradeReviewMutation.mutate("hard")}>Hard</button><button type="button" onClick={() => gradeReviewMutation.mutate("medium")}>Medium</button><button type="button" onClick={() => gradeReviewMutation.mutate("easy")}>Easy</button></div> : <button type="button" onClick={() => ensureReviewScheduleMutation.mutate()}>Start review scheduling</button>}</article> : null}
      </aside>

      {cleared ? <div className="catalog-cleared-backdrop"><div><span>Returned</span><h2>Deck cleared.</h2><p>{deck.cards.length} cards graded and re-shelved. The librarian nods approvingly.</p><button type="button" onClick={restart}>Run it again</button><Link href="/dashboard">Back to desk</Link></div></div> : null}
    </section>
  );
}
