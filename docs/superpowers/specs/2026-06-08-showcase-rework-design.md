# Showcase rework — design

- **Date:** 2026-06-08
- **Status:** Approved (design); pending implementation plan
- **Scope:** `examples/vanilla-fps-demo` only. No changes to the plugin (`src/`).

## Problem

The demo at `examples/vanilla-fps-demo` stacks four unrelated demonstrations
on one page with equal visual weight and no narrative:

1. A/B streaming layout-shift comparison
2. `lines`-mode CSS-variable showcase strip
3. `pretext:measured` measurement chips
4. FPS / main-thread-blocking benchmark (modal)

Plus a single control bar crammed with **11 controls** (stream, interval,
+cards, burst, mode, toggle width, measurements, three font selects, FPS,
reset). A first-time visitor has no idea where to look or what the "aha" is.

## Goals

- A **front door optimized for a visceral "wow"**: someone who has never heard
  of CLS feels the problem within ~3 seconds, no instructions.
- **Proof one scroll down** for skeptics (reproducible A/B + FPS benchmark).
- **Move the feature surface** (the source of control overload) to a separate
  page so it stops competing with the pitch.

## Non-goals

- No plugin/runtime changes.
- No new framework (stays vanilla TS).
- Not a visual-design system overhaul — this is information architecture +
  narrative. Styling stays in the demo's existing idiom.

## Decisions (settled during brainstorming)

| Decision | Choice |
|---|---|
| Primary job of the page | Marketing "wow" front door; technical proof one scroll down; feature playground on a separate page |
| Hero interaction | **Auto-playing split-screen A/B**, **looping** (~6s cycle, resets so latecomers catch the jump) with a live unexpected-shift scoreboard |
| Page structure | **Landing (proof inline) + separate `/playground` page** |
| FPS test | Stays a **modal**, triggered from the landing's proof section; keeps `#fps` deep-link |
| Build model | **Vite MPA** — two HTML entry points (`index.html`, `playground.html`) |

## Landing page (`index.html`)

Narrative spine: **Feel it → reproduce it → measure it → ship it.** Each
section answers the previous one's "yeah, but…".

1. **Top bar** — logo, tagline, links: GitHub · npm · Playground. No controls.
2. **Hero — "Text that never jumps."**
   - Looping auto A/B: identical cards stream into WITH (left, steady) and
     WITHOUT (right, jumping) on a ~6s loop that resets and replays.
   - Live unexpected-shift scoreboard: `WITH 0px` vs `WITHOUT NNNpx`, plus a
     `▮ replaying ↻` indicator.
   - CTAs: copy-to-clipboard install (`npm i -D vite-pretext`) and
     "See the proof ↓" (scrolls to section 3).
   - **Accessibility:** honors `prefers-reduced-motion: reduce` — the loop
     does not auto-run; instead shows a static side-by-side with a manual
     "Replay" button.
3. **Poke it yourself** — a **second, independent A/B instance** (its own feed
   pair + `ShiftMeter` pair, separate from the hero's auto-loop) with a
   **small grouped toolbar** (~4 controls: stream/burst, lazy↔instant mode,
   a single quick font-swap toggle, toggle width) so skeptics reproduce the
   effect with their own parameters. Replaces the 11-button bar. The
   shift-meter stats (cumulative / unexpected / events / max per side) render
   here. Note: this section's font-swap is one quick toggle for the reflow
   demo — the full sans/serif/mono selects live on the Playground page, not
   here.
4. **Off the main thread** — the FPS benchmark section: a short explainer plus
   a "Run FPS test" button opening the existing modal. Reports the fps speedup
   of cached `min-height` reads vs forced-layout `offsetHeight` reads. Keeps
   the `#fps` hash deep-link behavior.
5. **Get started** — install snippet, minimal `vite.config.ts` example, and a
   prominent "Explore every mode → Playground" link.
6. **Footer.**

## Playground page (`playground.html`, new)

The feature surface, each as a **labeled, separated demo card** with a
one-line explanation:

- **The four modes** — `height`, `width`, `lines`, `none`, each with a live
  example showing what inline style / CSS vars / events it produces.
- **`lines`-mode resizable card** — the CSS-variable-driven typography demo
  (drag to resize, headline restyles by `--pretext-line-count`). Relocated
  from today's "Showcase" strip.
- **Measurement chips** — the `pretext:measured` toggle showing
  `naturalWidth · height · lineCount` per element.
- **Font selects** — sans / serif / mono, demonstrating webfont-swap
  re-measure (`document.fonts.ready` + `remeasureAll()`).
- **Per-element config** — short examples of `data-pretext-*` attributes
  (`mode`, `text`, `white-space`, `word-break`, `apply-styles`, `no-settle`).

This is the "does it fit my use case" sandbox, no longer competing with the
pitch.

## Technical approach

### Build (Vite MPA)
- Two HTML entry points: `index.html` (landing) and `playground.html`.
  Vite resolves multiple top-level `.html` files natively; add explicit
  `build.rollupOptions.input` if needed.
- **Verify GitHub Pages deploy still works:** `deploy-demo.yml` builds with
  `VITE_BASE_URL=/vite-pretext/`. Confirm both `index.html` and
  `playground.html` emit with the correct base-prefixed asset + cross-page
  links, and that the `vite-pretext-bootstrap` script injects on both pages.

### Module reuse (keep, mostly as-is)
- `feed.ts` — heterogeneous card factory. Reused by hero, poke-it, and FPS.
- `shift-meter.ts` — cumulative / unexpected / max shift tracking. Reused in
  the poke-it section.
- `article.ts` — lede mount. Reused where a long-form block is wanted.
- `fonts.ts` — font catalogue + `loadFonts` / `applyFontVars`. Used by the
  poke-it font-swap and the Playground font selects.
- `fps-test.ts` — the modal benchmark. Reused unchanged on the landing.
- `measurement-badges.ts` — `pretext:measured` chip wiring. Moves to
  Playground.

### Re-split the wiring
- Today's monolithic `main.ts` (262 lines doing everything) splits into:
  - `landing.ts` — entry for `index.html`: hero loop + poke-it controls +
    FPS modal trigger.
  - `playground.ts` — entry for `playground.html`: modes, chips, fonts,
    per-element examples.
  - Shared helpers stay in their existing focused modules.

### New: looping hero driver
- A small module (e.g. `hero-loop.ts`) that drives the streamer on a loop:
  fill content → let pretext measure → hold ~Ns → reset both columns → repeat.
  Auto-starts on load. Pauses/loops respecting `prefers-reduced-motion`.
- `streamer.ts` gains (or is wrapped to support) a resettable, repeatable
  cycle for this; its existing instant/lazy modes are preserved for the
  poke-it section.

## Cuts

- The 11-control mega-bar (replaced by the grouped poke-it toolbar).
- The `reading-ruler` anchor element.
- The standalone "Showcase" strip and inline measurement-chip toggle relocate
  to Playground.

## Verification

- `pnpm --filter vanilla-fps-demo build` produces both pages.
- `pnpm --filter vanilla-fps-demo dev` serves both routes; hero auto-loops;
  poke-it controls work; FPS modal opens (button + `#fps`).
- `prefers-reduced-motion` disables the auto-loop (manual replay only).
- A production build with `VITE_BASE_URL=/vite-pretext/` keeps both pages and
  the bootstrap script working under a sub-path (mirrors GitHub Pages).
- Root `pnpm typecheck` stays green (the example is in the workspace
  typecheck).

## Open questions

None blocking. Visual polish (exact copy, color treatment) is deferred to
implementation.
