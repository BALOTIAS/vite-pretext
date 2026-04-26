// Pure DOM-style application for a single measurement result.
//
// Lives outside `orchestrator.ts` so it can be unit-tested in jsdom — the
// orchestrator spawns a Worker at module top level and is therefore not
// importable in a test environment.

import type { Measurement, OutputMode } from './types.js';

/**
 * Apply a measurement to an element. Always queued as a microtask to
 * sidestep SSR hydration mismatches (RFC edge case 3): synchronous style
 * writes inside a worker `message` handler can fire mid-hydration.
 *
 * - `height` + applyStyles: writes `min-height`.
 * - `width`  + applyStyles: writes `width`, adding the element's
 *   horizontal padding + border so a padded button doesn't under-shrink.
 * - `lines` and `none`: never write inline styles. Same when
 *   `applyStyles` is false for any mode.
 *
 * The `pretext-hydrated` class is added unconditionally so consumers can
 * style on it regardless of whether inline styles were applied.
 */
export function applyResult(
  el: HTMLElement,
  mode: OutputMode,
  applyStyles: boolean,
  m: Measurement,
): void {
  queueMicrotask(() => {
    if (applyStyles) {
      if (mode === 'height' && m.height != null) {
        el.style.minHeight = m.height + 'px';
      } else if (mode === 'width' && m.naturalWidth != null) {
        const cs = window.getComputedStyle(el);
        const chrome =
          (parseFloat(cs.paddingLeft) || 0) +
          (parseFloat(cs.paddingRight) || 0) +
          (parseFloat(cs.borderLeftWidth) || 0) +
          (parseFloat(cs.borderRightWidth) || 0);
        el.style.width = Math.ceil(m.naturalWidth + chrome) + 'px';
      }
    }
    el.classList.add('pretext-hydrated');
  });
}
