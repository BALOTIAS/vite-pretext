// Looping hero driver. Streams identical cards into a WITH and a WITHOUT
// column on a cycle; the WITHOUT side's 250ms lazy-fill (see streamer.ts)
// lands outside the expected-shift window and accumulates "unexpected" shift,
// while pretext reserves height on the WITH side and holds at zero. The live
// scoreboard reports each side's unexpected-shift total. After a hold, the
// stage clears and the cycle repeats so latecomers still catch the jump.
//
// prefers-reduced-motion: reduce — no auto-loop. Fill once, show a Replay
// button.

import { Streamer } from './streamer.js';
import { ShiftMeter } from './shift-meter.js';

export interface HeroLoopElements {
  feedWith: HTMLElement;
  feedWithout: HTMLElement;
  scoreWith: HTMLElement;
  scoreWithout: HTMLElement;
  status: HTMLElement;
  replayBtn: HTMLButtonElement;
}

const STREAM_INTERVAL_MS = 280; // card cadence during the fill
const FILL_CARDS = 6;           // cards streamed per cycle
const FILL_SETTLE_MS = 350;     // wait for the 250ms lazy fill to land
const HOLD_MS = 1800;           // pause on the settled diff before reset
const SAMPLE_MS = 50;           // scoreboard sampling cadence

export class HeroLoop {
  private streamer: Streamer;
  private meterWith = new ShiftMeter();
  private meterWithout = new ShiftMeter();
  private sampleTimer: number | null = null;
  private cycleTimer: number | null = null;
  private fillTimer: number | null = null;
  private streamed = 0;
  private running = false;

  constructor(private els: HeroLoopElements) {
    this.streamer = new Streamer(
      els.feedWith,
      els.feedWithout,
      this.meterWith,
      this.meterWithout,
    );
    this.streamer.mode = 'lazy';
    els.replayBtn.addEventListener('click', () => this.runOnce());
  }

  start(): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sampleTimer = window.setInterval(() => this.sample(), SAMPLE_MS);
    if (reduced) {
      this.els.replayBtn.hidden = false;
      this.els.status.textContent = 'paused · reduced motion';
      this.runOnce();
    } else {
      this.els.replayBtn.hidden = true;
      this.running = true;
      this.cycle();
    }
  }

  stop(): void {
    this.running = false;
    this.streamer.stop();
    // cycleTimer is a setTimeout; sampleTimer + fillTimer are setInterval.
    if (this.cycleTimer !== null) window.clearTimeout(this.cycleTimer);
    if (this.fillTimer !== null) window.clearInterval(this.fillTimer);
    if (this.sampleTimer !== null) window.clearInterval(this.sampleTimer);
    this.sampleTimer = this.cycleTimer = this.fillTimer = null;
  }

  private runOnce(): void {
    if (this.fillTimer !== null) return; // a fill is already in flight
    if (this.cycleTimer !== null) {
      window.clearTimeout(this.cycleTimer); // cancel a pending settle-wait
      this.cycleTimer = null;
    }
    this.resetStage();
    this.els.status.textContent = 'streaming…';
    this.streamFill(() => {
      this.els.status.textContent = 'settled';
    });
  }

  private cycle(): void {
    if (!this.running) return;
    this.resetStage();
    this.els.status.textContent = 'streaming…';
    this.streamFill(() => {
      this.els.status.textContent = 'replaying ↻';
      this.cycleTimer = window.setTimeout(() => this.cycle(), HOLD_MS);
    });
  }

  private resetStage(): void {
    this.streamer.clear();
    this.meterWith.reset();
    this.meterWithout.reset();
    this.streamed = 0;
    this.els.scoreWith.textContent = '0 px';
    this.els.scoreWithout.textContent = '0 px';
  }

  private streamFill(onDone: () => void): void {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // Empty baseline; tracked elements are added as cards stream in.
        this.meterWith.snapshot([]);
        this.meterWithout.snapshot([]);
        this.fillTimer = window.setInterval(() => {
          this.streamer.burst(1);
          this.streamed++;
          if (this.streamed >= FILL_CARDS) {
            if (this.fillTimer !== null) window.clearInterval(this.fillTimer);
            this.fillTimer = null;
            // Stored as cycleTimer so stop() can cancel the settle wait too.
            this.cycleTimer = window.setTimeout(onDone, FILL_SETTLE_MS);
          }
        }, STREAM_INTERVAL_MS);
      }),
    );
  }

  private sample(): void {
    this.meterWith.measure();
    this.meterWithout.measure();
    this.els.scoreWith.textContent = this.meterWith.unexpected.toFixed(0) + ' px';
    this.els.scoreWithout.textContent =
      this.meterWithout.unexpected.toFixed(0) + ' px';
  }
}
