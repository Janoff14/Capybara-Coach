import type { FlashcardRead } from "@/lib/types";

export type FlashcardDeck = {
  sessionId: string;
  documentId: string;
  documentTitle: string;
  noteId: string | null;
  createdAt: string;
  updatedAt: string;
  cards: FlashcardRead[];
};

export function groupFlashcardsIntoDecks(cards: FlashcardRead[]): FlashcardDeck[] {
  const deckMap = new Map<string, FlashcardDeck>();

  for (const card of cards) {
    const existing = deckMap.get(card.study_session_id);
    if (!existing) {
      deckMap.set(card.study_session_id, {
        sessionId: card.study_session_id,
        documentId: card.document_id,
        documentTitle: card.document_title,
        noteId: card.note_id,
        createdAt: card.created_at,
        updatedAt: card.updated_at,
        cards: [card],
      });
      continue;
    }

    existing.cards.push(card);
    if (new Date(card.updated_at).getTime() > new Date(existing.updatedAt).getTime()) {
      existing.updatedAt = card.updated_at;
    }
  }

  return Array.from(deckMap.values())
    .map((deck) => ({
      ...deck,
      cards: [...deck.cards].sort((left, right) => left.order_index - right.order_index),
    }))
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
}
