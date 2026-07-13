# Decisions

## 2026-07-13: Remove Dark Theme Instead Of Hiding The Toggle

- Problem: the app had a light/dark reader theme, but the product direction is light-only.
- Chosen solution: remove dark-theme state, localStorage startup script, theme-aware toaster logic, lamp toggle UI, and dark-only CSS selectors.
- Reason: keeping unused theme code would leave hidden state paths and stale visual rules that can reappear later.
- Alternatives rejected: hide the lamp button but keep dark CSS; force `theme="light"` while leaving stored user preference logic.
- Trade-offs: less visual flexibility, but simpler UI state and fewer style branches.
- Affected files: `app/layout.tsx`, `app/providers.tsx`, `components/app/reader-catalog-shell.tsx`, `components/app/auth-shell.tsx`, `app/globals.css`.

## 2026-07-13: Refresh Review Cache After Deck Generation

- Problem: generating a deck from Practice refreshed flashcards but could leave review schedule data stale.
- Chosen solution: invalidate the React Query `["reviews"]` cache after successful deck generation.
- Reason: the backend creates or ensures a review schedule when flashcards are generated, so the frontend must refetch both related resources.
- Alternatives rejected: manually patch the review cache without refetching; wait for natural query refresh.
- Trade-offs: one extra API request after deck generation, but the due/interval card stays accurate.
- Affected files: `app/(protected)/practice/page.tsx`.

## 2026-07-13: Source Discovery Should Be Backend-Owned

- Problem: AI-discovered reading sources need provider credentials, validation, filtering, and eventual document import.
- Chosen solution: treat source discovery as a backend service with a frontend command and display flow.
- Reason: backend ownership keeps search/API secrets out of the browser and gives one place to enforce quality and import rules.
- Alternatives rejected: frontend-only search; automatic source fetching without user request.
- Trade-offs: more backend work before UI payoff, but safer and easier to integrate with existing documents.
- Affected files: `backend/app/services/source_discovery.py`, `backend/app/api/routes/sources.py`, `backend/app/schemas/source.py`, `lib/api.ts`, and `lib/types.ts`.

## 2026-07-13: Use OpenAlex For First Source Suggestions

- Problem: source discovery needs real external candidates without adding paid search credentials or new dependencies.
- Chosen solution: query OpenAlex Works with standard-library HTTP, then normalize title, authors, abstract, open-access URL, and citation metadata.
- Reason: OpenAlex is an open scholarly metadata API and fits the app's learning-source use case.
- Alternatives rejected: generic frontend web search; adding a new paid search provider before the UX is validated.
- Trade-offs: stronger for scholarly sources than general web pages; may miss textbooks, blogs, or videos.
- Affected files: `backend/app/services/source_discovery.py`, `backend/tests/test_source_discovery.py`.

## 2026-07-13: Display Source Suggestions In Both Catalog And Reader

- Problem: users may want extra readings from the library overview or while reading a specific document.
- Chosen solution: create one reusable `SourceSuggestionsPanel` and render it in both `documents` and `study/[sessionId]/read`.
- Reason: the shared component keeps the command/results interaction consistent while each page supplies its own context.
- Alternatives rejected: only putting source search in the catalog; building separate components for document and catalog modes.
- Trade-offs: the reader page becomes denser, but source discovery stays available at the moment the user is studying.
- Affected files: `components/app/source-suggestions-panel.tsx`, `app/(protected)/documents/page.tsx`, `app/(protected)/study/[sessionId]/read/page.tsx`, `app/globals.css`.

## 2026-07-13: Derive Document Suggestions From Text Before Title

- Problem: a noisy document title can produce irrelevant source suggestions.
- Chosen solution: in document mode, leave the focus input empty by default and let the backend prioritize phrases extracted from document text.
- Reason: the document body usually carries better learning concepts than a filename or test title.
- Alternatives rejected: always search the document title; force the user to type a topic every time.
- Trade-offs: simple phrase extraction can still miss nuance, but it is safer than trusting titles and can be improved behind the same API.
- Affected files: `components/app/source-suggestions-panel.tsx`, `backend/app/api/routes/sources.py`, `backend/app/services/source_discovery.py`, `backend/tests/test_source_discovery.py`.
