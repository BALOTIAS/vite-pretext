// FPS test: measures the cost of layout-forcing reads, twice.
//
// Two equal-length phases run back-to-back over a heterogeneous corpus —
// headings, paragraphs, blockquotes, tables, deeply-nested outlines and
// comment threads — pulled from the same card factory the streaming demo
// uses. Tables in particular punish phase A: an offsetHeight read on a
// <td> forces the browser to re-resolve column widths and rebuild table
// layout, which scales much worse than a flat paragraph list.
//
//   Phase A — WITHOUT pretext: per element, write a layout-affecting style
//     (paddingLeft) then read offsetHeight. The read forces a synchronous
//     layout because there is a pending write. With ~250 markers spanning
//     tables, outlines and threads, this is the canonical layout-thrashing
//     anti-pattern at scale; fps drops.
//
//   Phase B — WITH pretext: same writes, but the read targets the
//     pretext-cached style.minHeight (a string read from inline style — no
//     layout invalidation). One coalesced layout per frame; fps holds.
//
// Configurable via the settings panel: card count, phase duration, lazy
// load (half the markers start blank and fill on a schedule, simulating
// async content arrival mid-test), and typeface. A rAF-driven spinner
// gives a visible FPS indicator throughout.

import { nextCard } from './feed.js';
import {
  applyFontVars,
  DEFAULT_SELECTIONS,
  loadFonts,
  populateSelect,
  type FontSelections,
} from './fonts.js';

const FPS_SAMPLE_MS = 250;
// Pretext re-measures all markers on setEnabled(true) / remeasureAll(); these
// gaps give the worker time to drain its queue before we start reading
// style.minHeight in phase B.
const WARMUP_MS = 600;
const INTER_PHASE_MS = 500;

type Phase = 'idle' | 'without' | 'with';

/**
 * What the work loop does each frame. All three exercise the same
 * write-then-read anti-pattern; the difference is which DOM property is
 * read (and how many times) per element.
 *
 * - `virtual` — write paddingLeft + read offsetHeight. The canonical
 *   virtual-list cost: one forced layout per element per frame.
 * - `thrash` — interleaved writes + reads (paddingLeft → offsetHeight →
 *   marginTop → offsetWidth). Two forced layouts per element per frame —
 *   worst case for phase A.
 * - `shrinkwrap` — write paddingLeft + read offsetWidth. Demonstrates
 *   width-mode reads (chat bubbles, badges, button labels). The corpus
 *   gets `data-pretext-mode="width"` so phase B can read the cached
 *   `--pretext-natural-width` instead.
 */
type Workload = 'virtual' | 'thrash' | 'shrinkwrap';

const WORKLOAD_LABEL: Record<Workload, string> = {
  virtual: 'virtual list — one offsetHeight read / element',
  thrash: 'layout thrash — interleaved height+width reads (worst case)',
  shrinkwrap: 'auto-fit / shrink-wrap — read offsetWidth, mode="width" markers',
};

function populateWorkloadSelect(select: HTMLSelectElement, value: Workload = 'virtual'): void {
  select.innerHTML = '';
  for (const key of ['virtual', 'thrash', 'shrinkwrap'] as const) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = WORKLOAD_LABEL[key];
    select.appendChild(opt);
  }
  select.value = value;
}

interface Phases {
  without: number;
  with: number;
}

interface FpsOptions {
  cardCount: number;
  durationMs: number;
  lazy: boolean;
  selections: FontSelections;
  workload: Workload;
}

const DEFAULT_OPTIONS: FpsOptions = {
  cardCount: 50,
  durationMs: 10000,
  lazy: true,
  selections: { ...DEFAULT_SELECTIONS },
  workload: 'virtual',
};

function hasWebfont(sel: FontSelections): boolean {
  return sel.sans !== 'system' || sel.serif !== 'system' || sel.mono !== 'system';
}

function clampMin(n: number, min: number): number {
  return Math.max(min, n);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export class FpsTest {
  private elements: HTMLElement[] = [];
  private phase: Phase = 'idle';
  private phaseStart = 0;
  private framesInPhase = 0;
  private framesSinceFpsSample = 0;
  private lastFpsSample = 0;
  private iterations = 0;
  private rafId = 0;
  private spinAngle = 0;
  private collected: Phases = { without: 0, with: 0 };
  private hasResult = false;
  private onClose?: () => void;
  private options: FpsOptions = { ...DEFAULT_OPTIONS };

  // Lazy-load state: each entry is a marker whose textContent we capture and
  // blank out at phase start, then schedule to be restored mid-phase.
  private lazyEntries: { el: HTMLElement; text: string }[] = [];
  private fillTimers: number[] = [];

  // DOM refs
  private modal: HTMLElement;
  private content: HTMLElement;
  private spinner: HTMLElement;
  private phaseLabel: HTMLElement;
  private countdown: HTMLElement;
  private fpsCurrent: HTMLElement;
  private iterCurrent: HTMLElement;
  private results: HTMLElement;
  private resultWithout: HTMLElement;
  private resultWith: HTMLElement;
  private resultRatio: HTMLElement;
  private inputCards: HTMLInputElement;
  private inputDuration: HTMLInputElement;
  private inputLazy: HTMLInputElement;
  private inputSans: HTMLSelectElement;
  private inputSerif: HTMLSelectElement;
  private inputMono: HTMLSelectElement;
  private inputWorkload: HTMLSelectElement;
  private btnRun: HTMLButtonElement;

  constructor(modalRoot: HTMLElement) {
    this.modal = modalRoot;
    this.content = modalRoot.querySelector('#fps-content') as HTMLElement;
    this.spinner = modalRoot.querySelector('#fps-spinner') as HTMLElement;
    this.phaseLabel = modalRoot.querySelector('#fps-phase-label') as HTMLElement;
    this.countdown = modalRoot.querySelector('#fps-countdown') as HTMLElement;
    this.fpsCurrent = modalRoot.querySelector('#fps-current') as HTMLElement;
    this.iterCurrent = modalRoot.querySelector('#fps-iter') as HTMLElement;
    this.results = modalRoot.querySelector('#fps-results') as HTMLElement;
    this.resultWithout = modalRoot.querySelector('#fps-result-without') as HTMLElement;
    this.resultWith = modalRoot.querySelector('#fps-result-with') as HTMLElement;
    this.resultRatio = modalRoot.querySelector('#fps-result-ratio') as HTMLElement;
    this.inputCards = modalRoot.querySelector('#fps-opt-cards') as HTMLInputElement;
    this.inputDuration = modalRoot.querySelector('#fps-opt-duration') as HTMLInputElement;
    this.inputLazy = modalRoot.querySelector('#fps-opt-lazy') as HTMLInputElement;
    this.inputSans = modalRoot.querySelector('#fps-opt-sans') as HTMLSelectElement;
    this.inputSerif = modalRoot.querySelector('#fps-opt-serif') as HTMLSelectElement;
    this.inputMono = modalRoot.querySelector('#fps-opt-mono') as HTMLSelectElement;
    populateSelect(this.inputSans, 'sans');
    populateSelect(this.inputSerif, 'serif');
    populateSelect(this.inputMono, 'mono');
    this.inputWorkload = modalRoot.querySelector('#fps-opt-workload') as HTMLSelectElement;
    populateWorkloadSelect(this.inputWorkload);
    this.btnRun = modalRoot.querySelector('#fps-btn-run') as HTMLButtonElement;

    modalRoot.querySelector('#fps-btn-close')!.addEventListener('click', () => this.close());
    this.btnRun.addEventListener('click', () => this.run());
  }

  open(onClose: () => void): void {
    this.onClose = onClose;
    this.modal.hidden = false;
    this.modal.dataset.phase = 'idle';
    this.results.hidden = true;
    this.phaseLabel.textContent = 'configure and click Run test';
    this.countdown.textContent = '—';
    this.fpsCurrent.textContent = '—';
    this.iterCurrent.textContent = '0';
    this.applyOptionsToInputs();
    this.setRunButtonLabel();
    this.disableSettings(false);
  }

  close(): void {
    this.cancel();
    this.modal.hidden = true;
    this.onClose?.();
  }

  private applyOptionsToInputs(): void {
    this.inputCards.value = String(this.options.cardCount);
    this.inputDuration.value = String(Math.round(this.options.durationMs / 1000));
    this.inputLazy.checked = this.options.lazy;
    this.inputSans.value = this.options.selections.sans;
    this.inputSerif.value = this.options.selections.serif;
    this.inputMono.value = this.options.selections.mono;
    this.inputWorkload.value = this.options.workload;
  }

  private readOptionsFromInputs(): void {
    const cards = parseInt(this.inputCards.value, 10);
    const dur = parseInt(this.inputDuration.value, 10);
    this.options.cardCount = clampMin(Number.isFinite(cards) ? cards : 50, 1);
    this.options.durationMs = clamp(Number.isFinite(dur) ? dur : 10, 2, 60) * 1000;
    this.options.lazy = this.inputLazy.checked;
    this.options.selections = {
      sans: this.inputSans.value,
      serif: this.inputSerif.value,
      mono: this.inputMono.value,
    };
    const w = this.inputWorkload.value;
    this.options.workload =
      w === 'thrash' || w === 'shrinkwrap' || w === 'virtual' ? (w as Workload) : 'virtual';
    // Mirror the clamped values back so the user sees what's actually used.
    this.applyOptionsToInputs();
  }

  private setRunButtonLabel(): void {
    this.btnRun.textContent = this.hasResult ? 'Run again' : 'Run test';
  }

  private disableSettings(disabled: boolean): void {
    this.inputCards.disabled = disabled;
    this.inputDuration.disabled = disabled;
    this.inputLazy.disabled = disabled;
    this.inputSans.disabled = disabled;
    this.inputSerif.disabled = disabled;
    this.inputMono.disabled = disabled;
    this.inputWorkload.disabled = disabled;
    this.btnRun.disabled = disabled;
    if (disabled) this.btnRun.textContent = 'Running…';
    else this.setRunButtonLabel();
  }

  private buildContent(): void {
    this.content.innerHTML = '';
    this.elements = [];
    this.lazyEntries = [];
    // Pull from the same heterogeneous card factory the streaming demo uses.
    // Mixed typography (display serif, mono, body sans), nested structures
    // (threads, outlines), tables, lists — and table cells in particular
    // force full table layout when their offsetHeight is read.
    for (let i = 0; i < this.options.cardCount; i++) {
      const pair = nextCard();
      this.content.appendChild(pair.withNode);
      for (const t of pair.withTracked) this.elements.push(t);
    }
    // Apply font selections by setting the same --font-* variables the card
    // styles already consume. This scopes the override to .fps-content and
    // does not touch the rest of the page.
    applyFontVars(this.content, this.options.selections);
    // For the shrink-wrap workload, mark every leaf with mode="width" so
    // pretext computes naturalWidth and exposes it as
    // --pretext-natural-width. The warmup remeasureAll() picks it up.
    for (const el of this.elements) {
      if (this.options.workload === 'shrinkwrap') {
        el.setAttribute('data-pretext-mode', 'width');
      } else {
        el.removeAttribute('data-pretext-mode');
      }
    }
    // Capture text on every other marker so the lazy schedule has something to
    // restore mid-phase. We capture even when lazy is off — toggling at run
    // time then becomes a no-op (we just don't schedule fills).
    for (let i = 0; i < this.elements.length; i += 2) {
      const el = this.elements[i]!;
      this.lazyEntries.push({ el, text: el.textContent ?? '' });
    }
  }

  private blankLazyEntries(): void {
    for (const entry of this.lazyEntries) entry.el.textContent = '';
  }

  private restoreLazyEntries(): void {
    for (const entry of this.lazyEntries) entry.el.textContent = entry.text;
  }

  private scheduleLazyFills(): void {
    this.cancelFillTimers();
    if (!this.options.lazy || this.lazyEntries.length === 0) return;
    const N = this.lazyEntries.length;
    const interval = this.options.durationMs / (N + 1);
    for (let i = 0; i < N; i++) {
      const entry = this.lazyEntries[i]!;
      this.fillTimers.push(
        window.setTimeout(() => {
          entry.el.textContent = entry.text;
        }, interval * (i + 1)),
      );
    }
  }

  private cancelFillTimers(): void {
    for (const t of this.fillTimers) clearTimeout(t);
    this.fillTimers = [];
  }

  private async run(): Promise<void> {
    this.cancel();
    this.readOptionsFromInputs();
    this.disableSettings(true);
    this.results.hidden = true;
    this.iterations = 0;
    this.collected = { without: 0, with: 0 };
    this.fpsCurrent.textContent = '—';
    this.iterCurrent.textContent = '0';
    this.countdown.textContent = '—';

    // Webfonts go in BEFORE buildContent so pretext measures with the final
    // typography in place. loadFonts is a no-op when every slot is system.
    if (hasWebfont(this.options.selections)) {
      this.phaseLabel.textContent = 'loading webfonts…';
      try {
        await loadFonts(this.options.selections);
      } catch {
        // Network failure — fall through with system fallbacks.
      }
    }

    this.phaseLabel.textContent = 'building corpus…';
    this.buildContent();

    this.phaseLabel.textContent = 'warming up — pretext measuring corpus…';
    window.__vitePretext?.setEnabled(true);
    window.__vitePretext?.remeasureAll();
    setTimeout(() => this.startPhase('without'), WARMUP_MS);
  }

  private cancel(): void {
    this.phase = 'idle';
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.cancelFillTimers();
    window.__vitePretext?.setEnabled(true);
  }

  private startPhase(phase: 'without' | 'with'): void {
    // Lazy state: re-blank, then schedule fills evenly across the phase.
    if (this.options.lazy && this.lazyEntries.length > 0) {
      this.blankLazyEntries();
    }

    this.phase = phase;
    const now = performance.now();
    this.phaseStart = now;
    this.lastFpsSample = now;
    this.framesInPhase = 0;
    this.framesSinceFpsSample = 0;
    // Iterations are per-phase, matching countdown / fps semantics. Without
    // this reset, phase 2 keeps incrementing from where phase 1 left off and
    // the header reads as if the corpus is doing more work than it is.
    this.iterations = 0;
    this.iterCurrent.textContent = '0';
    if (phase === 'without') {
      this.phaseLabel.textContent = 'Phase 1 / 2 — WITHOUT pretext (offsetHeight read forces layout)';
      this.modal.dataset.phase = 'without';
      window.__vitePretext?.setEnabled(false);
    } else {
      this.phaseLabel.textContent = 'Phase 2 / 2 — WITH pretext (cached min-height, no layout)';
      this.modal.dataset.phase = 'with';
      window.__vitePretext?.setEnabled(true);
    }
    this.scheduleLazyFills();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    if (this.phase === 'idle') return;
    const elapsed = now - this.phaseStart;

    // Work loop: per-element write (layout-affecting) + read. In phase A the
    // reads force synchronous layout; in phase B the reads are inline-style
    // / CSS-variable lookups — no layout flush. The exact pattern depends
    // on the selected workload.
    let total = 0;
    const padding = (this.framesInPhase % 8) + 'px';
    const margin = ((this.framesInPhase + 3) % 8) + 'px';
    const els = this.elements;
    const N = els.length;
    if (this.phase === 'without') {
      switch (this.options.workload) {
        case 'virtual': {
          for (let i = 0; i < N; i++) {
            const el = els[i]!;
            el.style.paddingLeft = padding;
            total += el.offsetHeight;
          }
          break;
        }
        case 'thrash': {
          // Two write/read pairs per element → two forced layouts each.
          for (let i = 0; i < N; i++) {
            const el = els[i]!;
            el.style.paddingLeft = padding;
            total += el.offsetHeight;
            el.style.marginTop = margin;
            total += el.offsetWidth;
          }
          break;
        }
        case 'shrinkwrap': {
          for (let i = 0; i < N; i++) {
            const el = els[i]!;
            el.style.paddingLeft = padding;
            total += el.offsetWidth;
          }
          break;
        }
      }
    } else {
      switch (this.options.workload) {
        case 'virtual': {
          for (let i = 0; i < N; i++) {
            const el = els[i]!;
            el.style.paddingLeft = padding;
            total += parseFloat(el.style.minHeight) || 0;
          }
          break;
        }
        case 'thrash': {
          // Same write pattern as phase A; reads target two CSS variables
          // (--pretext-line-count / --pretext-height) — both layout-free.
          for (let i = 0; i < N; i++) {
            const el = els[i]!;
            el.style.paddingLeft = padding;
            total += parseFloat(el.style.minHeight) || 0;
            el.style.marginTop = margin;
            total += parseFloat(el.style.getPropertyValue('--pretext-line-count')) || 0;
          }
          break;
        }
        case 'shrinkwrap': {
          for (let i = 0; i < N; i++) {
            const el = els[i]!;
            el.style.paddingLeft = padding;
            total += parseFloat(el.style.getPropertyValue('--pretext-natural-width')) || 0;
          }
          break;
        }
      }
    }
    if (Number.isNaN(total) || total < 0) console.log(total);
    this.iterations += N;

    // Visible spinner: rAF-driven so it actually reflects main-thread health.
    this.spinAngle += 0.18;
    this.spinner.style.transform = `rotate(${this.spinAngle}rad)`;

    this.framesInPhase++;
    this.framesSinceFpsSample++;

    if (now - this.lastFpsSample >= FPS_SAMPLE_MS) {
      const fps = (this.framesSinceFpsSample / (now - this.lastFpsSample)) * 1000;
      this.fpsCurrent.textContent = fps.toFixed(0);
      this.framesSinceFpsSample = 0;
      this.lastFpsSample = now;
    }
    this.iterCurrent.textContent = this.iterations.toLocaleString();
    this.countdown.textContent =
      Math.max(0, (this.options.durationMs - elapsed) / 1000).toFixed(1) + 's';

    if (elapsed >= this.options.durationMs) {
      const avgFps = (this.framesInPhase / elapsed) * 1000;
      this.collected[this.phase] = avgFps;
      this.cancelFillTimers();
      if (this.phase === 'without') {
        this.phase = 'idle';
        this.phaseLabel.textContent = 'pretext re-measuring corpus before phase 2…';
        // Make sure all blanked text is back so phase B starts from a clean
        // baseline corpus.
        this.restoreLazyEntries();
        window.__vitePretext?.setEnabled(true);
        window.__vitePretext?.remeasureAll();
        setTimeout(() => this.startPhase('with'), INTER_PHASE_MS);
      } else {
        this.finish();
      }
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  private finish(): void {
    this.phase = 'idle';
    this.modal.dataset.phase = 'done';
    this.cancelFillTimers();
    this.restoreLazyEntries();
    window.__vitePretext?.setEnabled(true);
    this.resultWithout.textContent = this.collected.without.toFixed(1) + ' fps';
    this.resultWith.textContent = this.collected.with.toFixed(1) + ' fps';
    if (this.collected.without > 0) {
      const ratio = this.collected.with / this.collected.without;
      this.resultRatio.textContent = ratio.toFixed(2) + '×';
    } else {
      this.resultRatio.textContent = '—';
    }
    this.results.hidden = false;
    this.hasResult = true;
    this.disableSettings(false);
    this.phaseLabel.textContent = 'done — adjust settings and Run again, or close';
  }
}
