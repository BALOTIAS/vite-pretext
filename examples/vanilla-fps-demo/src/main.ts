import { mountLede } from './article.js';
import { buildCssVarsShowcase, buildInitial } from './feed.js';
import { installMeasurementBadges } from './measurement-badges.js';
import { Streamer } from './streamer.js';
import type { StreamMode } from './streamer.js';
import { ShiftMeter } from './shift-meter.js';
import { FpsTest } from './fps-test.js';
import {
  applyFontVars,
  DEFAULT_SELECTIONS,
  loadFonts,
  populateSelect,
  type FontSelections,
  type FontSlot,
} from './fonts.js';

const feedWith = document.getElementById('feed-with') as HTMLElement;
const feedWithout = document.getElementById('feed-without') as HTMLElement;
const articleWith = document.getElementById('article-with') as HTMLElement;
const articleWithout = document.getElementById('article-without') as HTMLElement;

const out = {
  shiftWith: document.getElementById('shift-with') as HTMLElement,
  shiftWithout: document.getElementById('shift-without') as HTMLElement,
  unexpectedWith: document.getElementById('unexpected-with') as HTMLElement,
  unexpectedWithout: document.getElementById('unexpected-without') as HTMLElement,
  eventsWith: document.getElementById('events-with') as HTMLElement,
  eventsWithout: document.getElementById('events-without') as HTMLElement,
  maxWith: document.getElementById('max-with') as HTMLElement,
  maxWithout: document.getElementById('max-without') as HTMLElement,
  delta: document.getElementById('stat-delta') as HTMLElement,
  ratio: document.getElementById('stat-ratio') as HTMLElement,
  cards: document.getElementById('stat-cards') as HTMLElement,
  measure: document.getElementById('stat-measure') as HTMLElement,
};

const streamBtn = document.getElementById('btn-stream') as HTMLButtonElement;
const modeBtn = document.getElementById('btn-mode') as HTMLButtonElement;
const burstBtn = document.getElementById('btn-burst') as HTMLButtonElement;
const optBurst = document.getElementById('opt-burst') as HTMLInputElement;
const optInterval = document.getElementById('opt-interval') as HTMLInputElement;

function readBurstCount(): number {
  const n = parseInt(optBurst.value, 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

function readIntervalMs(): number {
  const n = parseInt(optInterval.value, 10);
  if (!Number.isFinite(n)) return 220;
  return Math.min(2000, Math.max(50, n));
}

function updateBurstLabel(): void {
  burstBtn.textContent = `+${readBurstCount()} cards`;
}

optBurst.addEventListener('input', updateBurstLabel);
updateBurstLabel();

const meterWith = new ShiftMeter();
const meterWithout = new ShiftMeter();
const root = document.documentElement;

const initial = buildInitial();
const trackedWith: HTMLElement[] = [];
const trackedWithout: HTMLElement[] = [];

function mountInitial(): void {
  for (const pair of initial) {
    feedWith.appendChild(pair.withNode);
    feedWithout.appendChild(pair.withoutNode);
    trackedWith.push(...pair.withTracked);
    trackedWithout.push(...pair.withoutTracked);
  }
  trackedWith.push(...mountLede(articleWith, true));
  trackedWithout.push(...mountLede(articleWithout, false));
}

mountInitial();

// Lines-mode showcase strip — single card, lives outside the A/B comparison
// because its CSS treatment depends on `--pretext-line-count`, which isn't
// written on the no-marker side.
const showcaseHost = document.getElementById('showcase-card');
if (showcaseHost) showcaseHost.appendChild(buildCssVarsShowcase());

const streamer = new Streamer(feedWith, feedWithout, meterWith, meterWithout);
streamer.mode = 'lazy';

function takeBaseline(): void {
  meterWith.snapshot(trackedWith);
  meterWithout.snapshot(trackedWithout);
  renderStats();
}

requestAnimationFrame(() => requestAnimationFrame(takeBaseline));

function fmtPx(n: number): string {
  return n.toFixed(0) + ' px';
}

function renderStats(): void {
  out.shiftWith.textContent = fmtPx(meterWith.cumulative);
  out.shiftWithout.textContent = fmtPx(meterWithout.cumulative);
  out.unexpectedWith.textContent = fmtPx(meterWith.unexpected);
  out.unexpectedWithout.textContent = fmtPx(meterWithout.unexpected);
  out.eventsWith.textContent = String(meterWith.events);
  out.eventsWithout.textContent = String(meterWithout.events);
  out.maxWith.textContent = fmtPx(meterWith.maxEvent);
  out.maxWithout.textContent = fmtPx(meterWithout.maxEvent);

  const delta = meterWithout.unexpected - meterWith.unexpected;
  out.delta.textContent = (delta >= 0 ? '+' : '') + fmtPx(delta);
  out.delta.dataset.bad = delta > 5 ? '1' : '0';

  if (meterWith.unexpected < 1) {
    out.ratio.textContent = meterWithout.unexpected < 1 ? '—' : '∞';
  } else {
    const r = meterWithout.unexpected / meterWith.unexpected;
    out.ratio.textContent = r.toFixed(1) + '×';
  }

  out.cards.textContent = String(streamer.count);
  const stats = window.__vitePretext?.getStats();
  if (stats) out.measure.textContent = stats.lastMeasureMs.toFixed(2) + ' ms';
}

function sample(): void {
  meterWith.measure();
  meterWithout.measure();
  renderStats();
}
setInterval(sample, 50);

function setStreamButtonState(active: boolean): void {
  streamBtn.textContent = active ? '⏸ Stop streaming' : '▶ Start streaming';
  streamBtn.dataset.active = active ? '1' : '0';
}

function setMode(mode: StreamMode): void {
  streamer.mode = mode;
  modeBtn.dataset.mode = mode;
  modeBtn.querySelector('strong')!.textContent = mode;
}

streamBtn.addEventListener('click', () => {
  if (streamer.isRunning) {
    streamer.stop();
    setStreamButtonState(false);
  } else {
    streamer.start(readIntervalMs());
    setStreamButtonState(true);
  }
});

modeBtn.addEventListener('click', () => {
  setMode(streamer.mode === 'instant' ? 'lazy' : 'instant');
});

burstBtn.addEventListener('click', () => {
  streamer.burst(readBurstCount());
});

document.getElementById('btn-reflow')!.addEventListener('click', () => {
  // Width changes are an expected interaction — annotate the window so the
  // reflow does not pollute the unexpected-shift bucket.
  meterWith.markExpected(400);
  meterWithout.markExpected(400);
  root.classList.toggle('wide-cols');
});

// Measurement chips — listens to the `pretext:measured` event and stamps a
// data-pt-info attribute on every measured element. CSS shows the chips
// only when `.show-measurements` is on the root, so the toggle is a pure
// CSS class flip.
installMeasurementBadges();
const measurementsBtn = document.getElementById('btn-measurements') as HTMLButtonElement;
measurementsBtn.addEventListener('click', () => {
  const on = root.classList.toggle('show-measurements');
  measurementsBtn.dataset.active = on ? '1' : '0';
});

// Three independent font selects (sans / serif / mono). Each defaults to
// system; switching to a Google font loads it via gstatic, awaits
// document.fonts.ready, and triggers a pretext re-measure so min-heights
// track the new metrics. The shift caused by the swap is annotated as
// expected so it doesn't pollute the unexpected-shift bucket.
const fontSelects: Record<FontSlot, HTMLSelectElement> = {
  sans: document.getElementById('font-sans') as HTMLSelectElement,
  serif: document.getElementById('font-serif') as HTMLSelectElement,
  mono: document.getElementById('font-mono') as HTMLSelectElement,
};
const selections: FontSelections = { ...DEFAULT_SELECTIONS };
for (const slot of ['sans', 'serif', 'mono'] as const) {
  populateSelect(fontSelects[slot], slot, selections[slot]);
  fontSelects[slot].addEventListener('change', () => {
    selections[slot] = fontSelects[slot].value;
    void applyFonts();
  });
}

async function applyFonts(): Promise<void> {
  // Apply the named family stack immediately. The browser will paint with
  // the system fallback until the woff2 arrives, then swap — that swap is
  // the canonical webfont reflow this demo is meant to demonstrate.
  applyFontVars(root, selections);
  meterWith.markExpected(800);
  meterWithout.markExpected(800);
  try {
    await loadFonts(selections);
  } catch {
    // network failure — system fallbacks remain in place
  }
  // Pretext's document.fonts.ready listener is one-shot; trigger a manual
  // re-measure so the WITH side updates min-heights to the new metrics.
  window.__vitePretext?.remeasureAll();
}

document.getElementById('btn-reset')!.addEventListener('click', () => {
  // Reset the run state: stop streaming, drop streamed cards, zero counters.
  // Width and font selections are deliberately left as-is so the user can
  // compare runs under the same layout conditions.
  streamer.stop();
  setStreamButtonState(false);
  streamer.count = 0;
  while (feedWith.children.length > initial.length) feedWith.firstChild?.remove();
  while (feedWithout.children.length > initial.length) feedWithout.firstChild?.remove();
  meterWith.reset();
  meterWithout.reset();
  requestAnimationFrame(() => requestAnimationFrame(takeBaseline));
});

const fpsModal = document.getElementById('fps-modal') as HTMLElement;
const fpsTest = new FpsTest(fpsModal);
const fpsBtn = document.getElementById('btn-fps') as HTMLButtonElement;
fpsBtn.addEventListener('click', () => {
  // The streaming loop and the FPS test compete for the main thread; pause
  // streaming for the duration so the test result reflects the work loop only.
  const wasStreaming = streamer.isRunning;
  if (wasStreaming) {
    streamer.stop();
    setStreamButtonState(false);
  }
  fpsTest.open(() => {
    if (wasStreaming) {
      streamer.start(readIntervalMs());
      setStreamButtonState(true);
    }
  });
});

// Deep-link `#fps` opens the FPS modal directly. Reuses the click handler so
// streaming pause + onClose restore behave the same as a manual click. Listens
// to hashchange so back/forward navigation works too.
function openFpsFromHash(): void {
  if (window.location.hash !== '#fps') return;
  if (!fpsModal.hidden) return;
  fpsBtn.click();
}
openFpsFromHash();
window.addEventListener('hashchange', openFpsFromHash);
