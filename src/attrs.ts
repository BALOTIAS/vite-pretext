// Per-element configuration parsed from `data-pretext-*` attributes.
//
// All optional. A bare `<p data-pretext>` produces { mode: 'height' } and
// every other field undefined — backward-compatible with v0.1 behaviour.

import type { OutputMode } from './types.js';

export interface MarkerAttrs {
  /** Override `textContent` for measurement purposes (async-fill hint). */
  text?: string;
  /** What pretext should do with the measurement. Defaults to `'height'`. */
  mode: OutputMode;
  /** Forwarded to pretext's `prepare()`. Defaults to `'normal'`. */
  whiteSpace?: 'normal' | 'pre-wrap';
  /** Forwarded to pretext's `prepare()`. Defaults to `'normal'`. */
  wordBreak?: 'normal' | 'keep-all';
  /** Forwarded to pretext's `prepare()`. Numeric CSS-px value. */
  letterSpacing?: number;
  /**
   * Per-element override of the plugin's `applyStyles` option. `undefined`
   * means inherit; `true` / `false` win over the plugin default.
   */
  applyStyles?: boolean;
}

const VALID_MODES: ReadonlySet<string> = new Set(['height', 'width', 'lines', 'none']);

export function readMarkerAttrs(el: Element): MarkerAttrs {
  const text = el.getAttribute('data-pretext-text');
  const modeAttr = el.getAttribute('data-pretext-mode');
  const ws = el.getAttribute('data-pretext-white-space');
  const wb = el.getAttribute('data-pretext-word-break');
  const ls = el.getAttribute('data-pretext-letter-spacing');
  const apply = el.getAttribute('data-pretext-apply-styles');

  const mode: OutputMode =
    modeAttr != null && VALID_MODES.has(modeAttr) ? (modeAttr as OutputMode) : 'height';

  // Number('') === 0, not NaN, so treat empty string as absent.
  const lsNum = ls != null && ls !== '' ? Number(ls) : NaN;

  let applyStyles: boolean | undefined;
  if (apply === 'false') applyStyles = false;
  else if (apply === 'true') applyStyles = true;

  return {
    text: text != null && text !== '' ? text : undefined,
    mode,
    whiteSpace: ws === 'pre-wrap' ? 'pre-wrap' : undefined,
    wordBreak: wb === 'keep-all' ? 'keep-all' : undefined,
    letterSpacing: Number.isFinite(lsNum) ? lsNum : undefined,
    applyStyles,
  };
}

/**
 * Read `letter-spacing` from a computed style as a numeric px value. Returns
 * `undefined` for the CSS keyword `'normal'` (which `parseFloat` produces
 * `NaN` for) or zero (no need to forward — pretext's default is 0). Used to
 * auto-detect the value when the user hasn't set
 * `data-pretext-letter-spacing` explicitly.
 */
export function autoLetterSpacing(style: CSSStyleDeclaration): number | undefined {
  const v = parseFloat(style.letterSpacing);
  return Number.isFinite(v) && v !== 0 ? v : undefined;
}
