export interface VitePretextOptions {
  fallbacks?: {
    fontFamily?: string;
    fontSize?: string;
    lineHeight?: string;
  };
  include?: (string | RegExp)[];
  /**
   * Emit build warnings when layout-forcing DOM reads are detected in your
   * source (offsetHeight, getBoundingClientRect, clientWidth, …). These are
   * the calls that synchronously trigger layout — exactly what pretext is
   * designed to replace with cached `el.style.minHeight` reads.
   *
   * Heuristic: simple text scan, may produce false positives in comments or
   * strings. Defaults to `true`. Set `false` to silence.
   */
  warn?: boolean;
  /**
   * Whether the orchestrator should write inline styles (`min-height` /
   * `width`) to measured elements. Set to `false` to skip the inline-style
   * application but keep CSS variables, the `pretext:measured` event, and
   * the JS API — useful when you'd rather apply the style yourself in CSS.
   *
   * Default `true`. Each marker can override per-element via
   * `data-pretext-apply-styles="false"` or `="true"`.
   */
  applyStyles?: boolean;
  /**
   * Extend the built-in tag sets that drive the smart-marker walk.
   * - `textLeaf`: extra tags that should be measured as leaves
   *   (custom-element headings, framework atoms). Auto-promoted into the
   *   block set so parents containing only custom leaves still walk in.
   * - `block`: extra tags that count as block-level children, telling
   *   their parent "this is a container, walk in."
   *
   * Always extends; never replaces. Tag names are case-insensitive. Avoid
   * adding inline-by-default tags like `<a>`, `<button>`, `<label>` here —
   * they break the common `<p>See <a>here</a></p>` measurement.
   */
  tags?: {
    textLeaf?: string[];
    block?: string[];
  };
}

/**
 * What the orchestrator does with the worker's measurement.
 * - `height` (default): apply `min-height = layout.height`. The CLS
 *   prevention story.
 * - `width`: apply `width = naturalWidth + horizontal padding`. Shrink-wraps
 *   the element to fit its text — chat bubbles, badges, button labels.
 * - `lines`: apply nothing inline; only the CSS variable
 *   `--pretext-line-count` is set, so the consumer can style off it.
 * - `none`: apply nothing and skip CSS variables entirely; the
 *   `pretext:measured` event still fires so custom code can take over.
 */
export type OutputMode = 'height' | 'width' | 'lines' | 'none';

export interface MeasureRequest {
  id: string;
  text: string;
  font: string;
  lineHeight: number;
  width: number;
  /** Defaults to `'height'` if absent for forward compatibility. */
  mode?: OutputMode;
  whiteSpace?: 'normal' | 'pre-wrap';
  wordBreak?: 'normal' | 'keep-all';
  letterSpacing?: number;
}

export interface MeasureResponse {
  id: string;
  /** Layout height at the requested width. Always populated for non-`none` modes. */
  height?: number;
  /** Number of wrapped lines at the requested width. */
  lineCount?: number;
  /**
   * The widest forced line — i.e. the smallest container width that fits
   * the text without breaking on whitespace. Populated only for `width` mode.
   */
  naturalWidth?: number;
  /** The widest *actually-laid-out* line at the requested width. */
  maxLineWidth?: number;
}

/**
 * The user-facing snapshot of a single element's measurement. Cached in a
 * WeakMap and surfaced via `window.__vitePretext.getMeasurement`, the
 * `pretext:measured` DOM event, and inline CSS custom properties.
 */
export interface Measurement {
  height?: number;
  lineCount?: number;
  naturalWidth?: number;
  maxLineWidth?: number;
}

export interface VitePretextConfig {
  fallbacks: Required<NonNullable<VitePretextOptions['fallbacks']>>;
  applyStyles: boolean;
  tags: { textLeaf: string[]; block: string[] };
}

declare global {
  interface Window {
    __VITE_PRETEXT_CONFIG__?: VitePretextConfig;
    __vitePretext?: {
      setEnabled: (enabled: boolean) => void;
      remeasureAll: () => void;
      getStats: () => { pendingCount: number; completedCount: number; lastMeasureMs: number };
      /** Latest cached measurement for an element, or `undefined` before first measure. */
      getMeasurement: (el: Element) => Measurement | undefined;
      /** Subscribe to future measurements for one element. Returns an unsubscribe. */
      observe: (el: Element, cb: (m: Measurement) => void) => () => void;
      /** Subscribe to every measurement globally. Returns an unsubscribe. */
      observeAll: (cb: (el: Element, m: Measurement) => void) => () => void;
    };
  }

  interface ElementEventMap {
    'pretext:measured': CustomEvent<Measurement>;
  }
}
