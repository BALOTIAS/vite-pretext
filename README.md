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
});
```

### `window.__vitePretext`

Runtime hook for tooling and demos.

```ts
window.__vitePretext.setEnabled(false);  // drop reserved heights, simulate "no plugin"
window.__vitePretext.setEnabled(true);   // re-measure and re-apply
window.__vitePretext.remeasureAll();     // force a re-measurement of every tracked element
window.__vitePretext.getStats();         // { pendingCount, completedCount, lastMeasureMs }
```

## Demo

**Live demo:** <https://balotias.github.io/vite-pretext/> — auto-deployed
from `main`.

A vanilla-HTML A/B comparison plus a layout-thrashing FPS benchmark lives in
[`examples/vanilla-fps-demo`](./examples/vanilla-fps-demo). Two columns render
the same heterogeneous corpus (headings, blockquotes, tables, lists, threads
with nested replies, outlines) — the left column has the marker, the right
doesn't. Stream cards in lazy mode and the right column's *unexpected shift*
counter climbs while the left's stays at zero. The FPS test runs a
layout-thrashing work loop twice (with pretext disabled, then enabled) and
reports the speedup.

To run it locally:

```sh
git clone https://github.com/BALOTIAS/vite-pretext.git
cd vite-pretext
pnpm install
pnpm dev
```

Open <http://localhost:5173/>.

## Requirements

Vite 8+. Vite 6/7 fallback via ESBuild is on the roadmap.

## License

MIT, see [LICENSE.md](./LICENSE.md).
