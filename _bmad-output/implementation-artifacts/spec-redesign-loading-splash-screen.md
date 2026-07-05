---
title: 'Redesign the loading splash screen for the reader catalog'
type: 'feature'
created: '2026-07-04'
status: 'done'
baseline_commit: '8c0cf36'
context:
  - 'C:/Users/sanja/Shoki/docs/architecture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The shared loading screen still uses the previous soft editorial panel and generic spinner, so every authentication check and initial redirect briefly breaks the new retro reading-room/card-catalog experience.

**Approach:** Replace it with a full-viewport loading composition that feels native to the reading room: a compact wooden masthead, a tactile catalog/checkout card, stamped status details, and a lightweight animated filing indicator. Keep the existing message API so all current route-gate copy continues to work.

## Boundaries & Constraints

**Always:** Preserve the `LoadingScreen` component contract and every existing call site; keep the current authentication/redirect behavior unchanged; use semantic loading state (`role="status"`, live-region messaging, and busy state); make decorative elements unavailable to assistive technology; support phone through desktop layouts; respect reduced-motion preferences; use the existing reader-catalog fonts, colors, texture, borders, and physical-paper visual language.

**Ask First:** Any change to loading duration, authentication state management, route destinations, or the persisted theme architecture.

**Never:** Add image assets or dependencies; display fake percentage completion; turn the splash into an interactive screen; duplicate the authenticated navigation shell; alter error-state behavior; introduce a second loading component.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Default load | No `message` prop | Catalog-themed splash announces “Loading your study workspace...” | N/A |
| Route-specific load | Existing custom `message` prop | Custom text is shown and announced without layout overflow | N/A |
| Reduced motion | OS requests reduced motion | Loading state remains visually clear with animation disabled | N/A |
| Narrow viewport | 320–640px viewport | Card remains readable and fully contained with no horizontal scroll | N/A |

</frozen-after-approval>

## Code Map

- `components/app/loading-screen.tsx` — Shared startup and route-gate loading UI used by the root page, public-only routes, and protected routes.
- `components/app/route-gates.tsx` — Supplies account-check and dashboard-opening messages without changing the loading component contract.
- `app/page.tsx` — Supplies the initial application-launch message.
- `app/globals.css` — Owns the retro reader-catalog tokens, paper/wood styling, responsive rules, and loading animations.

## Tasks & Acceptance

**Execution:**
- [x] `components/app/loading-screen.tsx` — Replace the legacy panel/spinner markup with the semantic catalog-themed splash while preserving the optional `message` prop.
- [x] `app/globals.css` — Add scoped splash layout, tactile card details, responsive behavior, animation, and reduced-motion fallback using existing design tokens.
- [x] Existing loading call sites — Verify all default and custom messages render correctly without behavioral edits.

**Acceptance Criteria:**
- Given the app is resolving authentication, when any current route renders `LoadingScreen`, then the viewport shows one cohesive reader-catalog splash rather than the legacy editorial panel.
- Given a loading message is provided, when the splash renders, then that exact message is visible and announced as the active status.
- Given a small screen or reduced-motion preference, when the splash renders, then it remains readable, overflow-free, and understandable without motion.
- Given the implementation is complete, when lint, typecheck, and production build run, then they pass without new errors.

## Spec Change Log

## Design Notes

The splash should resemble a request card being processed at a circulation desk, not a generic branded modal. Motion belongs to a short row of filing/index marks and a restrained stamp/paper entrance; the message is the focal point. Keep the visual hierarchy compact enough that short route transitions do not feel like a second page.

## Verification

**Commands:**
- `npm run lint` — expected: no new ESLint errors.
- `npm run typecheck` — expected: TypeScript completes successfully.
- `npm run build` — expected: Next.js production build succeeds.

**Manual checks:**
- Inspect `/`, `/login`, and a protected route at desktop and mobile widths; confirm the splash matches the catalog design and route transitions still resolve normally.
- Emulate `prefers-reduced-motion: reduce`; confirm the loader remains legible with motion removed.

## Suggested Review Order

**Semantic loading contract**

- Busy state wraps the operation while one focused live region announces the exact message.
  [`loading-screen.tsx:1`](../../components/app/loading-screen.tsx#L1)

- Status styling preserves hierarchy without claiming page landmarks or heading ownership.
  [`globals.css:639`](../../app/globals.css#L639)

**Responsive composition**

- Flex-based viewport sizing survives masthead growth and small dynamic viewports.
  [`globals.css:619`](../../app/globals.css#L619)

- Mobile spacing and type keep the request card contained at 320px.
  [`globals.css:654`](../../app/globals.css#L654)

**Motion and contrast safeguards**

- Transform-and-opacity filing marks avoid continuous paint-heavy background animation.
  [`globals.css:643`](../../app/globals.css#L643)

- Reduced-motion presents a neutral static indicator without implying fake progress.
  [`globals.css:672`](../../app/globals.css#L672)

- Forced-colors mode preserves card and indicator boundaries.
  [`globals.css:681`](../../app/globals.css#L681)
