# Stack Map

## Next.js App Router

- What it does: renders the React frontend routes under `app/`.
- Where it appears: `app/layout.tsx`, route folders such as `app/(protected)/practice/page.tsx`, and shared components under `components/app/`.
- How it interacts: protected pages call `lib/api.ts`, which talks to the FastAPI backend.
- Commands: `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Confidence: assisted.

## React Query

- What it does: caches API data and refetches it after mutations.
- Where it appears: `app/providers.tsx` creates the `QueryClient`; protected pages such as `app/(protected)/practice/page.tsx`, `app/(protected)/documents/page.tsx`, and `app/(protected)/study/[sessionId]/read/page.tsx` use queries and mutations.
- How it interacts: practice deck generation invalidates `["flashcards"]` and `["reviews"]` so the UI refetches deck and schedule state; source suggestions are fetched on command instead of cached as documents.
- Commands: covered by `npm run typecheck`, `npm run lint`, and `npm run build`.
- Confidence: assisted.

## FastAPI Backend

- What it does: owns study-session, flashcard, and review-schedule behavior.
- Where it appears: `backend/app/api/routes/reviews.py`, `backend/app/api/routes/sessions.py`, `backend/app/api/routes/sources.py`, and backend models/schemas.
- How it interacts: frontend calls `/reviews`, `/reviews/{session_id}/attempts`, `/sessions/{session_id}/flashcards`, and `/sources/suggestions` through `lib/api.ts`.
- Commands: from `backend/`, run `.\\.venv\\Scripts\\python.exe -m unittest discover -s tests -p "test_*.py"`.
- Confidence: assisted.

## OpenAlex Works API

- What it does: provides scholarly source metadata for papers, books, reviews, and related works.
- Where it appears: `backend/app/services/source_discovery.py`.
- How it interacts: source discovery builds queries from user topics or document text, sends them to OpenAlex, normalizes metadata, and returns source suggestions to the API route.
- Commands: covered by backend unit tests with network calls patched out.
- Confidence: assisted.

## Source Suggestions UI

- What it does: lets the user request additional readings without automatically adding them to the library.
- Where it appears: `components/app/source-suggestions-panel.tsx`, rendered by `app/(protected)/documents/page.tsx` and `app/(protected)/study/[sessionId]/read/page.tsx`.
- How it interacts: the component calls `api.getSourceSuggestions`, displays result cards, and links out to source URLs; document mode can search from the current document text with an optional focus input.
- Commands: `npm run typecheck`, `npm run lint`, `npm run build`, plus local Playwright visual smoke checks.
- Confidence: assisted.

## CSS Reader Theme

- What it does: defines the app's visual reader/card-catalog style.
- Where it appears: `app/globals.css`, `components/app/reader-catalog-shell.tsx`, and `components/app/auth-shell.tsx`.
- How it interacts: shell components apply `.reader-catalog`; CSS variables provide the single light visual system.
- Commands: `npm run lint`, `npm run build`; visual smoke through the local app when the dev server routes are available.
- Confidence: assisted.
