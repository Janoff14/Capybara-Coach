# Session Log

## 2026-07-13

- Feature worked on: verified spaced repetition, fixed review-cache refresh after deck generation, removed dark theme, and added on-demand source suggestions in the catalog and reader.
- Concepts covered: backend-owned scheduling, React Query cache invalidation, light-only design simplification, separating backend service ownership from frontend presentation, external API normalization, and visual smoke testing.
- Code completed by the user: identified that AI source discovery should be a backend service, with frontend display on command.
- Mistakes or misunderstandings observed: none significant; the ownership prediction was correct. Visual testing exposed a backend query-quality bug where document titles could overpower document text.
- Material to review later: why mutations often need to invalidate more than the resource they directly return; how suggested reader sources should become normal document records after user confirmation; why visual tests can reveal integration issues unit tests miss.
- Recommended next exercise: implement the user-confirmed "add selected source to library" flow so a suggestion becomes a normal document record only after approval.
