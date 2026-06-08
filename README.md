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
`data-pretext`. Stream cards in lazy mode and the right column's
*unexpected shift* counter climbs while the left stays at zero.

Specific things to look for:

- **`lines`-mode showcase strip** (the cyan banner *above* the A/B
  columns, not inside them). The heading is marked with
  `data-pretext-mode="lines"`; CSS attribute selectors on the inline
  `--pretext-line-count` swap the typographic treatment per line count
  (1 line: large + accent; 2 lines: medium; 3+: muted). The card is
  directly resizable — drag its bottom-right corner to flip the line
  count and watch the headline re-style in real time, with no JS in the
  styling path. Pulled out of the A/B comparison on purpose: the
  treatment depends on a pretext-only CSS variable, so a no-marker
  render has nothing to drive it.
- **📏 Measurements toggle.** Flips a class on the root that surfaces
  each WITH-side element's measurement (`naturalWidth · height ·
  lineCount`) via the `pretext:measured` DOM event, rendered as inline
  chips through a CSS pseudo-element so the chips don't contaminate
  pretext's own re-reads of `textContent`.
- **[FPS test →](https://balotias.github.io/vite-pretext/#fps)** — the
  bundled benchmark runs two equal-length phases over a heterogeneous
  corpus (paragraphs, tables, threads, outlines) and reports the fps
  speedup of cached `style.minHeight` reads against forced-layout
  `offsetHeight` reads. The `#fps` hash deep-links straight into the
  modal.

## Features

- **Zero configuration.** Drop the plugin in, mark elements, ship.
- **Off-main-thread measurement.** Worker-based; never blocks paint.
- **Four output modes.** `height` for CLS-prevention (default), `width`
  for shrink-wrap, `lines` for line-count CSS hooks, `none` for
  bring-your-own rendering. See [Modes](#modes).
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

That's it for the default flow: pretext scans your source for the marker,
spawns a worker, measures off-thread, and writes `min-height` to each
element so it holds its shape during webfont swap, fluid resize, and async
content fill. Switch to width-fit, line-count, or event-only via
[`data-pretext-mode`](#modes) below.

## Modes

Each marker writes one of four kinds of output, picked via
`data-pretext-mode`. The default is `height`.

| Mode                 | Inline style applied                      | CSS variables                                                | Use case                                                                             |
|----------------------|-------------------------------------------|--------------------------------------------------------------|--------------------------------------------------------------------------------------|
| `height` *(default)* | `min-height`                              | `--pretext-mode`, `--pretext-height`, `--pretext-line-count` | Reserve vertical space — prevent CLS during font swap, async fill, resize.           |
| `width`              | `width = naturalWidth + padding + border` | adds `--pretext-natural-width`, `--pretext-max-line-width`   | Shrink-wrap to content width — chat bubbles, badges, button labels.                  |
| `lines`              | *(none)*                                  | `--pretext-mode`, `--pretext-line-count`                     | Style by wrapped-line count without forcing a layout read.                           |
| `none`               | *(none)*                                  | *(none)*                                                     | Bring-your-own rendering — only the `pretext:measured` event + `getMeasurement(el)`. |

`lines` and `none` skip the inline write but the `pretext:measured` event
still fires and `getMeasurement(el)` still returns the cached snapshot. Use
the plugin-wide `applyStyles: false` option (or per-element
`data-pretext-apply-styles="false"`) to suppress the inline write while
keeping the CSS variables for `height` / `width` modes.

```html
<!-- height (default): reserve min-height -->
<p data-pretext>Long paragraph that should reserve its height…</p>

<!-- width: shrink-wrap a button to its label -->
<button data-pretext data-pretext-mode="width">Buy now</button>

<!-- lines: drive CSS off line count -->
<style>h2[style*="--pretext-line-count: 1"] { font-size: 2.5rem; }</style>
<h2 data-pretext data-pretext-mode="lines">Hangs on whether it wraps.</h2>

<!-- none: custom render path; subscribe via the event or the JS API -->
<div data-pretext data-pretext-mode="none">…</div>
<script>
  document.querySelector('div[data-pretext]')
    .addEventListener('pretext:measured', (e) => render(e.detail));
</script>
```

## Per-element configuration

Every marker accepts the optional `data-pretext-*` attributes below. All are
optional; absent means "use the default."

| Attribute                     | Values                                | Default                                    | Notes                                                                   |
|-------------------------------|---------------------------------------|--------------------------------------------|-------------------------------------------------------------------------|
| `data-pretext`                | (presence)                            | —                                          | The marker. Required to opt in.                                         |
| `data-pretext-mode`           | `height` / `width` / `lines` / `none` | `height`                                   | See [Modes](#modes).                                                    |
| `data-pretext-text`           | string                                | uses `el.textContent`                      | Override the text used for measurement — useful for skeleton-then-fill. |
| `data-pretext-white-space`    | `pre-wrap`                            | `normal`                                   | Forwarded to `pretext.prepare()`.                                       |
| `data-pretext-word-break`     | `keep-all`                            | `normal`                                   | Forwarded to `pretext.prepare()` — common for CJK content.              |
| `data-pretext-letter-spacing` | px number                             | auto-detected from `getComputedStyle`      | Override only when the computed style misses it.                        |
| `data-pretext-apply-styles`   | `true` / `false`                      | inherits the plugin's `applyStyles` option | Per-element opt-out of the inline-style write.                          |

```html
<!-- async-fill skeleton: measure the eventual text before it arrives -->
<p data-pretext data-pretext-text="Loading post body…"></p>

<!-- pretext.prepare() forwards -->
<pre data-pretext data-pretext-white-space="pre-wrap">{{raw}}</pre>
<p   data-pretext data-pretext-word-break="keep-all" lang="ja">…</p>
<h1  data-pretext data-pretext-letter-spacing="2">Tracked headline</h1>

<!-- keep CSS vars + events but skip the inline min-height/width write -->
<p data-pretext data-pretext-apply-styles="false">…</p>
```

## How it helps

Pretext earns its keep in four patterns:

1. **Off-main-thread layout queries.** Reading `offsetHeight` /
   `getBoundingClientRect` after a style write forces synchronous layout. With
   pretext, you read `el.style.minHeight` (or `getMeasurement(el)?.height`)
   instead — a layout-free lookup. Useful for virtual lists, masonry, or
   any code that needs row heights to position other items.
2. **Pre-reservation under async content.** When content arrives lazily
   (fetch, then fill), pages without reserved heights jump the moment text
   arrives. Put the text in DOM up front (visually masked), mark it, and
   pretext reserves the height before paint.
3. **Stable heights across font swaps.** Pretext re-measures every marked
   element when webfonts arrive (`document.fonts.ready`) and on resize
   (rAF-batched `ResizeObserver`).
4. **Shrink-wrap to content width.** With `data-pretext-mode="width"`, an
   element's inline `width` is set to its natural content width plus
   horizontal padding and border. Buttons, badges, and chat bubbles size
   cleanly to their text — and re-fit when labels swap (i18n, copy A/B)
   without `inline-block` + `white-space: nowrap` hacks.

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
  // clientHeight, scrollHeight + width siblings, getBoundingClientRect,
  // getClientRects, offsetTop/Left) appear in your source — those are
  // exactly the calls pretext is designed to replace. Each warning carries
  // an API-tailored replacement hint pointing at `getMeasurement(el)`,
  // the matching CSS variable, or — for position reads — rAF batching.
  // Suppress per-site with `// @vite-pretext-ignore` on the same line or
  // the line above (block-comment `/* @vite-pretext-ignore */` also works).
  // Set `false` to silence globally. Heuristic; may flag matches inside
  // strings.
  warn: true,
  // Whether the orchestrator writes inline styles (min-height / width) to
  // measured elements. Set false to keep CSS variables, events, and JS API
  // but skip the inline-style application — apply heights yourself in CSS.
  // Each marker can override per-element via data-pretext-apply-styles.
  applyStyles: true,
  // Extend the smart-marker walk's tag knowledge. Always extends, never
  // replaces; tag names are case-insensitive. Use `textLeaf` for custom
  // elements you want measured (auto-promoted into the block set so a
  // parent of only-custom-leaves still walks in). Use `block` for custom
  // containers that should make their parent walk in. Avoid adding
  // inline-by-default tags like `<a>`, `<button>`, `<label>` — they break
  // the very common `<p>See <a>here</a></p>` measurement.
  tags: {
    textLeaf: [], // e.g. ['my-headline', 'app-quote']
    block: [],    // e.g. ['app-section', 'card-body']
  },
});
```

The default tag sets cover standard HTML5:
- **Leaves (measured):** `p`, `h1`–`h6`, `li`, `td`, `th`, `caption`,
  `figcaption`, `blockquote`, `cite`, `dt`, `dd`, `summary`, `legend`.
- **Containers (walked into):** the leaves above plus `ul`, `ol`, `dl`,
  `table`, `thead`, `tbody`, `tfoot`, `tr`, `article`, `section`, `aside`,
  `div`, `nav`, `header`, `footer`, `main`, `figure`, `pre`, `address`,
  `hr`, `form`, `fieldset`, `details`, `dialog`.

### `window.__vitePretext`

Runtime hook for tooling, frameworks, and demos.

```ts
// lifecycle
window.__vitePretext.setEnabled(false);  // drop reserved styles, simulate "no plugin"
window.__vitePretext.setEnabled(true);   // re-measure and re-apply
window.__vitePretext.remeasureAll();     // force a re-measurement of every tracked element
window.__vitePretext.getStats();         // { pendingCount, completedCount, suppressedCount, lastMeasureMs }

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

## Stability: the CSS feedback loop

Driving CSS off the measurement variables — most usefully
`--pretext-line-count` in `lines` mode — lets you restyle an element by how
its text wraps, with no JavaScript in the styling path. If those rules change
a property that affects line breaking (`font-size`, `font-family`,
`letter-spacing`, `line-height`), the naïve sequence "measure → restyle → the
element re-wraps → re-measure" would loop forever at widths near a line-break
boundary.

pretext breaks this at the root. Its measurement depends only on an element's
**width**; a restyle that changes line breaking changes the element's
**height**, not its width. So the orchestrator ignores `ResizeObserver`
notifications whose width is unchanged since the last measurement — they're
self-induced and carry no new information. A genuine resize (the container
actually gets wider or narrower) still re-measures, and the explicit triggers
(`document.fonts.ready`, `remeasureAll()`) bypass the guard entirely. The
number of dropped notifications is exposed as `getStats().suppressedCount`.

The result: line-count-driven typography settles to one value per width and
holds — at a boundary width the pinned value is whatever the element first
measured there. Stable, never oscillating.

- **Drive these freely** (won't re-trigger line breaking): `color`,
  `text-decoration`, `font-weight` within the same metrics, `opacity`,
  `transform`, `background`, `border`.
- **Avoid driving these** from a measurement variable: anything that changes
  the element's own **width** (`width`, horizontal `padding`, `max-width`).
  Width-stable suppression can't see those, so they can still loop.
- **One caveat:** if a theme toggle swaps `font-family` *without* changing any
  element's width, the guard won't pick it up automatically — call
  `__vitePretext.remeasureAll()` from the toggle handler.

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
