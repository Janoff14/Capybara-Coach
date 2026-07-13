# Quiz Bank

## Questions

1. When `generateFlashcards` succeeds on the Practice page, why does the frontend need to invalidate both `["flashcards"]` and `["reviews"]`?
2. Which backend route currently applies a spaced-repetition rating to a review schedule after a written practice attempt?
3. Why is AI source discovery better owned by a backend service than a frontend component?
4. What is one risk of leaving dark-mode CSS in the app after removing the visible theme toggle?
5. What does `backend/app/services/source_discovery.py` normalize before returning source suggestions to the frontend?
6. Why does the first source-discovery slice return suggestions instead of immediately importing each source as a document?
7. Why does document-mode source discovery leave the focus input empty by default?
8. Which component is shared by the Documents page and the Reader page for displaying source suggestions?
9. What visual bug did the reader-page smoke test catch that backend unit tests did not catch at first?

## Answers

1. Deck generation changes the flashcard list and also creates or ensures the review schedule, so both cached resources can become stale.
2. `POST /reviews/{session_id}/attempts`, implemented in `backend/app/api/routes/reviews.py`.
3. The backend can protect search/provider credentials, rate-limit requests, validate sources, and later promote accepted sources into normal document records.
4. Hidden theme state or stale selectors can accidentally affect future UI, making styling harder to reason about.
5. It normalizes external OpenAlex works into stable app fields such as title, authors, year, source name, URL, DOI, abstract, open-access status, citation count, reason, and query.
6. User confirmation avoids filling the library with irrelevant, paywalled, duplicate, or low-quality sources.
7. An empty focus lets the backend derive search queries from the document text instead of blindly using a noisy title.
8. `components/app/source-suggestions-panel.tsx`.
9. The reader page was mechanically working, but the document title "Retrieval Practice Visual Test" caused irrelevant visual-retrieval search results until document text was prioritized.
