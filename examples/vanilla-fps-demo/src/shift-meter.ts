// Tracks cumulative vertical movement of a set of elements and classifies
// each shift as expected (within a recent intentional event window) or
// unexpected (outside it). The unexpected bucket is the analogue of CLS
// proper — shifts that happen while the user is reading, with no triggering
// action — and is the metric pretext is meant to drive toward zero.

const NOISE_THRESHOLD_PX = 1;

export class ShiftMeter {
  private positions = new Map<Element, number>();
  cumulative = 0;
  events = 0;
  maxEvent = 0;
  unexpected = 0;
  unexpectedEvents = 0;
  private expectedUntil = 0;

  /** Snapshot the current layout as the new baseline (no cumulative effect). */
  snapshot(elements: Iterable<Element>): void {
    this.positions.clear();
    for (const el of elements) this.positions.set(el, el.getBoundingClientRect().top);
  }

  /** Add this element to tracking with its current position. */
  track(el: Element): void {
    this.positions.set(el, el.getBoundingClientRect().top);
  }

  /** Untrack and forget about an element (no longer tracked). */
  untrack(el: Element): void {
    this.positions.delete(el);
  }

  /** Open an "expected event" window of length ms; shifts within it count as
   *  intentional and are excluded from the unexpected bucket. */
  markExpected(durationMs: number): void {
    this.expectedUntil = performance.now() + durationMs;
  }

  /** Compare current positions to last snapshot, accumulate, then re-snapshot.
   *  Returns the delta for this measurement. */
  measure(): number {
    let delta = 0;
    for (const [el, prevTop] of this.positions) {
      const nowTop = el.getBoundingClientRect().top;
      delta += Math.abs(nowTop - prevTop);
      this.positions.set(el, nowTop);
    }
    if (delta < NOISE_THRESHOLD_PX) return 0;
    this.cumulative += delta;
    this.events++;
    if (delta > this.maxEvent) this.maxEvent = delta;
    if (performance.now() > this.expectedUntil) {
      this.unexpected += delta;
      this.unexpectedEvents++;
    }
    return delta;
  }

  reset(): void {
    this.cumulative = 0;
    this.events = 0;
    this.maxEvent = 0;
    this.unexpected = 0;
    this.unexpectedEvents = 0;
    this.expectedUntil = 0;
    this.positions.clear();
  }
}
