import { describe, it, expect } from 'vitest';
import { shouldSkipResize, WIDTH_EPSILON_PX } from '../src/resize-guard.js';

// pretext's measurement is a pure function of (text, font, width). A
// ResizeObserver entry whose width is unchanged since the last measurement
// is a self-induced height change (e.g. a measurement-driven CSS rule
// animating font-size) and must be skipped, or it forms a feedback loop.
describe('shouldSkipResize', () => {
  it('never skips an element that has not been measured yet', () => {
    // No prior width recorded → we must measure to learn the line count.
    expect(shouldSkipResize(undefined, 320)).toBe(false);
  });

  it('skips when the width is identical to the last measurement', () => {
    // The exact loop signature: height changes, width does not.
    expect(shouldSkipResize(248, 248)).toBe(true);
  });

  it('skips a sub-pixel width change below the epsilon', () => {
    expect(shouldSkipResize(248, 248.4)).toBe(true);
    expect(shouldSkipResize(248, 247.6)).toBe(true);
  });

  it('re-measures when the width grows by at least one pixel', () => {
    expect(shouldSkipResize(248, 249)).toBe(false);
  });

  it('re-measures when the width shrinks by at least one pixel', () => {
    expect(shouldSkipResize(248, 247)).toBe(false);
  });

  it('re-measures a genuine resize across many pixels', () => {
    expect(shouldSkipResize(320, 540)).toBe(false);
  });

  it('exposes a 1px epsilon', () => {
    expect(WIDTH_EPSILON_PX).toBe(1);
  });
});
