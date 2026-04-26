import { nextCard, blankout } from './feed.js';
import type { ShiftMeter } from './shift-meter.js';

// Two streaming modes:
//
// 'instant' — both columns prepend cards with full text in DOM. Each insertion
//   is a single, expected shift. Pretext's measurement applies to elements
//   whose natural height was already known by the browser, so neither side
//   accumulates "unexpected" shift. Useful as a baseline.
//
// 'lazy' — simulates fetch-then-fill (the realistic async case):
//     • WITHOUT side: prepend a card with text-bearing elements blanked out.
//       Card is small. After 250ms, fill text in. Card grows. Existing
//       content shifts a SECOND time, while the user is reading — the
//       canonical CLS villain.
//     • WITH side: prepend a full card with marker. Pretext reserves height
//       on insertion (one expected shift). Card stays the same size; no
//       second shift.
//   meter.markExpected(120) is called on each tick so insertion-time shifts
//   land in the expected bucket; the 250ms fill on the without-side falls
//   outside the window and counts as unexpected.

export type StreamMode = 'instant' | 'lazy';

const EXPECTED_WINDOW_MS = 120;
const FILL_DELAY_MS = 250;

export class Streamer {
  private timer: number | null = null;
  count = 0;
  mode: StreamMode = 'instant';

  constructor(
    private feedWith: HTMLElement,
    private feedWithout: HTMLElement,
    private meterWith: ShiftMeter,
    private meterWithout: ShiftMeter,
  ) {}

  start(intervalMs: number): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), intervalMs);
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  burst(n: number): void {
    for (let i = 0; i < n; i++) this.tick();
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  private tick(): void {
    const pair = nextCard();
    this.meterWith.markExpected(EXPECTED_WINDOW_MS);
    this.meterWithout.markExpected(EXPECTED_WINDOW_MS);

    if (this.mode === 'lazy') {
      // Simulate fetch-then-fill: blank text on the without side, restore
      // after FILL_DELAY_MS. The with side gets full content immediately and
      // pretext reserves the height on insertion.
      const restore = blankout(pair.withoutTracked);
      pair.withoutNode.classList.add('lazy-skeleton');
      pair.withNode.classList.add('lazy-loading');

      this.feedWith.prepend(pair.withNode);
      this.feedWithout.prepend(pair.withoutNode);
      for (const t of pair.withTracked) this.meterWith.track(t);
      for (const t of pair.withoutTracked) this.meterWithout.track(t);

      window.setTimeout(() => {
        restore();
        pair.withoutNode.classList.remove('lazy-skeleton');
        pair.withNode.classList.remove('lazy-loading');
      }, FILL_DELAY_MS);
    } else {
      this.feedWith.prepend(pair.withNode);
      this.feedWithout.prepend(pair.withoutNode);
      for (const t of pair.withTracked) this.meterWith.track(t);
      for (const t of pair.withoutTracked) this.meterWithout.track(t);
    }

    this.count++;
  }
}
