// Always-on userland API surface for pretext's measurements:
// - inline CSS variables on each marked element
// - `pretext:measured` DOM event (bubbles)
// - JS API: getMeasurement, observe, observeAll
//
// No worker dependency — pure DOM + WeakMap so this module is testable in
// jsdom on its own.

import type { Measurement, OutputMode } from './types.js';

const cache = new WeakMap<Element, Measurement>();
const globalListeners = new Set<(el: Element, m: Measurement) => void>();

/**
 * Called by the orchestrator when a worker response arrives. Caches the
 * measurement, applies inline CSS variables (skipped for `mode === 'none'`),
 * dispatches the `pretext:measured` event, and notifies any global
 * observers.
 */
export function recordMeasurement(el: Element, mode: OutputMode, m: Measurement): void {
  cache.set(el, m);
  if (mode !== 'none') {
    applyCssVars(el as HTMLElement, mode, m);
  }
  const event = new CustomEvent<Measurement>('pretext:measured', {
    detail: m,
    bubbles: true,
  });
  el.dispatchEvent(event);
  for (const cb of globalListeners) cb(el, m);
}

/** Drop the cached measurement and any CSS vars. Called by setEnabled(false). */
export function clearMeasurement(el: Element): void {
  cache.delete(el);
  if (!isHtmlElement(el)) return;
  el.style.removeProperty('--pretext-mode');
  el.style.removeProperty('--pretext-height');
  el.style.removeProperty('--pretext-line-count');
  el.style.removeProperty('--pretext-natural-width');
  el.style.removeProperty('--pretext-max-line-width');
}

function applyCssVars(el: HTMLElement, mode: OutputMode, m: Measurement): void {
  el.style.setProperty('--pretext-mode', mode);
  if (m.height != null) el.style.setProperty('--pretext-height', String(m.height));
  if (m.lineCount != null) el.style.setProperty('--pretext-line-count', String(m.lineCount));
  if (m.naturalWidth != null) {
    el.style.setProperty('--pretext-natural-width', String(m.naturalWidth));
  }
  if (m.maxLineWidth != null) {
    el.style.setProperty('--pretext-max-line-width', String(m.maxLineWidth));
  }
}

function isHtmlElement(el: Element): el is HTMLElement {
  return 'style' in el;
}

/** Latest cached measurement, or undefined before pretext has measured this element. */
export function getMeasurement(el: Element): Measurement | undefined {
  return cache.get(el);
}

/**
 * Subscribe to future measurements for a single element. Returns an
 * unsubscribe function. Implementation is a thin wrapper over the DOM
 * event for users who'd rather not think about `addEventListener`.
 */
export function observe(el: Element, cb: (m: Measurement) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<Measurement>).detail);
  el.addEventListener('pretext:measured', handler);
  return () => {
    el.removeEventListener('pretext:measured', handler);
  };
}

/** Subscribe to every measurement globally. */
export function observeAll(cb: (el: Element, m: Measurement) => void): () => void {
  globalListeners.add(cb);
  return () => {
    globalListeners.delete(cb);
  };
}
