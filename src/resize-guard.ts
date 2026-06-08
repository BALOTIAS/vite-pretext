// CSS feedback-loop guard.
//
// pretext's measurement is a pure function of (text, font, width): width is
// its only *geometry* input. A `ResizeObserver`, however, fires for any size
// change — including height-only changes the measurement itself caused. When
// a user keys CSS off a measurement variable (e.g. `--pretext-line-count`)
// and that CSS touches a line-breaking property (`font-size`,
// `letter-spacing`, `line-height`, `font-family`), the sequence
// measure → restyle → ResizeObserver fires → re-measure settles into an
// infinite loop at line-break-boundary widths.
//
// The guard: in the ResizeObserver path, skip an element whose width is
// unchanged since its last measurement. A width-stable resize is self-induced
// and carries no new information for a width-keyed measurement. Genuine
// resizes (the container actually changes width) and the explicit re-measure
// triggers (webfont load, `remeasureAll`) are unaffected — the latter call
// the measurement path directly, bypassing this gate.
//
// Pure so it is unit-testable without spawning a worker.

/** Width deltas smaller than this (px) are treated as no change. */
export const WIDTH_EPSILON_PX = 1;

/**
 * True when a ResizeObserver entry should be skipped because the element's
 * measurable width has not meaningfully changed since the last measurement.
 *
 * @param prevWidth the `clientWidth` at the last measurement, or `undefined`
 *   if the element has never been measured (then we must measure).
 * @param currWidth the element's current `clientWidth`.
 */
export function shouldSkipResize(
  prevWidth: number | undefined,
  currWidth: number,
): boolean {
  if (prevWidth === undefined) return false;
  return Math.abs(currWidth - prevWidth) < WIDTH_EPSILON_PX;
}
