# vite-pretext

[![npm version](https://img.shields.io/npm/v/vite-pretext.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/vite-pretext)
[![npm downloads](https://img.shields.io/npm/dm/vite-pretext.svg?color=cb3837)](https://www.npmjs.com/package/vite-pretext)
[![CI](https://github.com/BALOTIAS/vite-pretext/actions/workflows/ci.yml/badge.svg)](https://github.com/BALOTIAS/vite-pretext/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-live-22c55e.svg?logo=githubpages&logoColor=white)](https://balotias.github.io/vite-pretext/)
[![License: MIT](https://img.shields.io/npm/l/vite-pretext.svg?color=blue)](https://github.com/BALOTIAS/vite-pretext/blob/main/LICENSE.md)
[![Vite](https://img.shields.io/badge/vite-%5E8.0.0-646cff.svg?logo=vite&logoColor=white)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> Zero-configuration Vite plugin that eliminates text-based Cumulative Layout
> Shift and main-thread layout blocking by delegating text measurement to a Web
> Worker via [`@chenglou/pretext`](https://www.npmjs.com/package/@chenglou/pretext).

## Demo

**[Try the live demo →](https://balotias.github.io/vite-pretext/)** — two
columns render the same content side by side, only the left has
`data-pretext`. Stream cards in lazy mode and the right column's *unexpected
shift* counter climbs while the left stays at zero; the bundled FPS test
reports the speedup of cached `style.minHeight` reads against
forced-layout `offsetHeight` reads.

## Features

- **Zero configuration.** Drop the plugin in, mark elements, ship.
- **Off-main-thread measurement.** Worker-based; never blocks paint.
- **Opt-in per element or per subtree.** Add `data-pretext` to a paragraph or
  to a whole article — the marker is smart enough to walk into block
  descendants on its own.
- **Reactive.** Re-measures on font load, resize, and visibility change.
- **No bundle bloat when unused.** Production builds emit nothing if the
  marker is absent from your source.

## Install

```sh
npm install -D vite-pretext
# or: pnpm add -D vite-pretext
# or: yarn add -D vite-pretext
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { vitePretext } from 'vite-pretext';

export default defineConfig({
  plugins: [vitePretext()],
});
```

Mark text elements you want measured. The marker is smart: applied to a leaf,
it measures that element; applied to a container with block-level children,
it walks in and measures the text-bearing leaves (`p`, `h1`–`h6`, `li`, `td`,
`th`, `figcaption`, `blockquote`, `cite`, `dt`, `dd`).

```html
<!-- per element -->
<p data-pretext>Long paragraph that should reserve its height…</p>

<!-- or once on a parent — the orchestrator finds the leaves -->
<article data-pretext>
  <h1>Headline</h1>
  <p>Lede…</p>
  <p>Body…</p>
</article>
```

That's it. The plugin scans your source and HTML for the marker. If found, it
injects a tiny bootstrap that spawns a worker, measures matching elements
off-thread, and applies `min-height` so they hold their shape during webfont
swap, fluid resize, and async content fill.

### Per-element configuration

Every marker accepts optional attributes for finer control:

```html
<!-- mode: 'height' (default) | 'width' (shrink-wrap) | 'lines' (CSS var only) | 'none' -->
<button data-pretext data-pretext-mode="width">Save changes</button>

<!-- async-fill hint: measure THIS text, even though textContent is empty -->
<p data-pretext data-pretext-text="Loading post body…"></p>

<!-- forwarded to pretext.prepare() options -->
<pre data-pretext data-pretext-white-space="pre-wrap">{{raw}}</pre>
<p data-pretext data-pretext-word-break="keep-all" lang="ja">…</p>
<h1 data-pretext data-pretext-letter-spacing="2">Tracked headline</h1>

<!-- skip inline-style application for this element only — keep CSS vars + events -->
<p data-pretext data-pretext-apply-styles="false">…</p>
```

`letter-spacing` is auto-detected from `getComputedStyle` when the attribute
is absent — set the attribute only to override.

## How it helps

Pretext earns its keep in three patterns:

1. **Off-main-thread layout queries.** Reading `offsetHeight` /
   `getBoundingClientRect` after a style write forces synchronous layout. With
   pretext, you read `el.style.minHeight` instead — a layout-free string
   lookup. Useful for virtual lists, masonry, or any code that needs row
   heights to position other items.
2. **Pre-reservation under async content.** When content arrives lazily
   (fetch, then fill), pages without reserved heights jump the moment text
   arrives. Put the text in DOM up front (visually masked), mark it, and
   pretext reserves the height before paint.
3. **Stable heights across font swaps.** Pretext re-measures every marked
   element when webfonts arrive (`document.fonts.ready`) and on resize
   (rAF-batched `ResizeObserver`).

What it does **not** do:

- Prevent shift from inserting fully-rendered HTML synchronously — the browser
  pays the natural-height cost either way.
- Server-side rendering. Min-heights are applied during hydration in a
  microtask, not baked into the HTML payload.

## API

### `vitePretext(options?)`

All options are optional; the defaults work for typical projects.

```ts
vitePretext({
  // Used only when getComputedStyle cannot resolve a value yet.
  fallbacks: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '16px',
    lineHeight: '1.5',
  },
  // File patterns scanned for the marker.
  include: [/\.[jt]sx?$/, /\.vue$/, /\.svelte$/, /\.html$/],
  // Emit build warnings when layout-forcing DOM reads (offsetHeight,
  // getBoundingClientRect, clientWidth, ...) appear in your source — those
  // are exactly the calls pretext is designed to replace. Set `false` to
  // silence. Heuristic; may flag matches inside comments or strings.
  warn: true,
  // Whether the orchestrator writes inline styles (min-height / width) to
  // measured elements. Set false to keep CSS variables, events, and JS API
  // but skip the inline-style application — apply heights yourself in CSS.
  // Each marker can override per-element via data-pretext-apply-styles.
  applyStyles: true,
});
```

### `window.__vitePretext`

Runtime hook for tooling, frameworks, and demos.

```ts
// lifecycle
window.__vitePretext.setEnabled(false);  // drop reserved styles, simulate "no plugin"
window.__vitePretext.setEnabled(true);   // re-measure and re-apply
window.__vitePretext.remeasureAll();     // force a re-measurement of every tracked element
window.__vitePretext.getStats();         // { pendingCount, completedCount, lastMeasureMs }

// per-element measurement access
window.__vitePretext.getMeasurement(el);
//  → { height, lineCount, naturalWidth?, maxLineWidth? } | undefined
window.__vitePretext.observe(el, (m) => { /* fires on each measurement */ });
window.__vitePretext.observeAll((el, m) => { /* every element, everywhere */ });
```

### CSS variables on every measured element

The orchestrator writes inline CSS variables onto each measured element
(unless `mode="none"`):

```
--pretext-mode: <height|width|lines|none>
--pretext-height: <px, no unit>
--pretext-line-count: <integer>
--pretext-natural-width: <px>      /* mode="width" only */
--pretext-max-line-width: <px>     /* mode="width" only */
```

Use them in CSS:

```css
.card[style*='--pretext-line-count: 1'] { font-size: 1.5rem; }
.card { height: calc(var(--pretext-height) * 1px); }
```

### `pretext:measured` DOM event

A bubbling `CustomEvent<Measurement>` dispatches on each marker after every
measurement. Equivalent to `observe(el, ...)`:

```ts
el.addEventListener('pretext:measured', (e) => {
  console.log(e.detail.lineCount);
});
```

## Run the demo locally

Source for the live demo lives at
[`examples/vanilla-fps-demo`](./examples/vanilla-fps-demo). It renders the
same heterogeneous corpus (headings, blockquotes, tables, lists, threads
with nested replies, outlines) in both columns; the left has the marker,
the right doesn't.

```sh
git clone https://github.com/BALOTIAS/vite-pretext.git
cd vite-pretext
pnpm install
pnpm dev      # opens http://localhost:5173/
```

## Requirements

Vite 8+. Vite 7 backport is on the roadmap but not guaranteed. No support for Vite 6 or older.

## Roadmap

Rough priority, top → bottom. Ideas in sketch form; nothing committed.

### Vite 7 backport

The bootstrap-chunk emit pattern relies on Rolldown's `emitFile`; on Vite 7 I'd
ship an ESBuild-based fallback behind a `configResolved` version branch.
Broadens the addressable user base by a lot. Vite 6 stays out — too old.

### Framework examples

I'm planning more framework-specific demos to show how pretext can slot into real apps:
* **React** (threaded comments with
`react-virtuoso`)
* **Vue** (e-commerce grid with reactive filters)
* **Angular** (data dashboard with CDK virtual scroll via Analog)
* **Svelte** (long-form reader with progressive sections)

Each picks the use
case where that framework's idioms put pressure on the surface pretext
fixes.

### Text-wrap `balance` mode

A `data-pretext-mode="balance"` that binary-searches widths via pretext's
`walkLineRanges` to find one that produces balanced-line output. Equivalent
to CSS `text-wrap: balance` but works in older browsers and stays
consistent across font swaps.

### Build-time text-fit checks

`data-pretext-max-lines="2"` / `data-pretext-max-width="240"` constraints
verified at build time using pretext server-side. Fails the build with
file/line diagnostics if any element overflows. Catches the "this German
translation broke our header" class of bug before deploy. Needs
`node-canvas` (or stable Node `OffscreenCanvas`) as an optional dep.

### SSR / RSC integration

Run pretext on the server during render, bake `min-height` into the HTML
payload before it ever hits the browser. Eliminates the hydration-microtask
delay entirely. Would ship as a separate `vite-pretext/ssr` entry rather
than altering the runtime.

### Rich-inline content

Wrap `@chenglou/pretext/rich-inline` for layouts that mix prose with
mentions, chips, inline code spans, and other atomic items. Useful for
chat composers and rich text editors. Narrow but underserved use case.

### Per-line manual layout

Expose `walkLineRanges`, `layoutWithLines`, and the cursor APIs through
the runtime hook so callers can drive line-level rendering themselves —
animated per-line reveals, search-result highlighting, custom text
effects. Probably stays out: anyone going this deep should call
`@chenglou/pretext` directly.

### WebGPU worker backend

Speculative. Pretext's segment preparation could parallelise across
compute shaders inside the worker. Plugin auto-detects WebGPU support and
injects a `.wgsl`-accelerated worker variant. Far-future; only worth it
if a benchmark proves the win.

## License

MIT, see [LICENSE.md](./LICENSE.md).
