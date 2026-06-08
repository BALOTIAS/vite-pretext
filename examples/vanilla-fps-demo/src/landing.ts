import { mountLede } from './article.js';
import { buildInitial } from './feed.js';
import { Streamer } from './streamer.js';
import type { StreamMode } from './streamer.js';
import { ShiftMeter } from './shift-meter.js';
import { FpsTest } from './fps-test.js';
import { applyFontVars, DEFAULT_SELECTIONS, loadFonts, type FontSelections } from './fonts.js';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

// ── Click-to-start A/B demo (manual; lives below the install section) ────────
const pkFeedWith = $('pk-feed-with');
const pkFeedWithout = $('pk-feed-without');
const pkMeterWith = new ShiftMeter();
const pkMeterWithout = new ShiftMeter();
const root = document.documentElement;

const pkTrackedWith: HTMLElement[] = [];
const pkTrackedWithout: HTMLElement[] = [];
const pkInitial = buildInitial();

for (const pair of pkInitial) {
  pkFeedWith.appendChild(pair.withNode);
  pkFeedWithout.appendChild(pair.withoutNode);
  pkTrackedWith.push(...pair.withTracked);
  pkTrackedWithout.push(...pair.withoutTracked);
}
pkTrackedWith.push(...mountLede($('pk-article-with'), true));
pkTrackedWithout.push(...mountLede($('pk-article-without'), false));

const pkStreamer = new Streamer(pkFeedWith, pkFeedWithout, pkMeterWith, pkMeterWithout);
pkStreamer.mode = 'lazy';

const pkOut = {
  shiftWith: $('pk-shift-with'),
  shiftWithout: $('pk-shift-without'),
  unexpectedWith: $('pk-unexpected-with'),
  unexpectedWithout: $('pk-unexpected-without'),
  eventsWith: $('pk-events-with'),
  eventsWithout: $('pk-events-without'),
  maxWith: $('pk-max-with'),
  maxWithout: $('pk-max-without'),
};
const fmtPx = (n: number) => n.toFixed(0) + ' px';

function pkRender(): void {
  pkOut.shiftWith.textContent = fmtPx(pkMeterWith.cumulative);
  pkOut.shiftWithout.textContent = fmtPx(pkMeterWithout.cumulative);
  pkOut.unexpectedWith.textContent = fmtPx(pkMeterWith.unexpected);
  pkOut.unexpectedWithout.textContent = fmtPx(pkMeterWithout.unexpected);
  pkOut.eventsWith.textContent = String(pkMeterWith.events);
  pkOut.eventsWithout.textContent = String(pkMeterWithout.events);
  pkOut.maxWith.textContent = fmtPx(pkMeterWith.maxEvent);
  pkOut.maxWithout.textContent = fmtPx(pkMeterWithout.maxEvent);
}

function pkBaseline(): void {
  pkMeterWith.snapshot(pkTrackedWith);
  pkMeterWithout.snapshot(pkTrackedWithout);
  pkRender();
}
requestAnimationFrame(() => requestAnimationFrame(pkBaseline));

setInterval(() => {
  pkMeterWith.measure();
  pkMeterWithout.measure();
  pkRender();
}, 50);

// Stream toggle
const pkStreamBtn = $('pk-stream') as HTMLButtonElement;
function setPkStreamState(active: boolean): void {
  pkStreamBtn.textContent = active ? '⏸ Stop streaming' : '▶ Start streaming';
  pkStreamBtn.dataset.active = active ? '1' : '0';
}
pkStreamBtn.addEventListener('click', () => {
  if (pkStreamer.isRunning) {
    pkStreamer.stop();
    setPkStreamState(false);
  } else {
    pkStreamer.start(220);
    setPkStreamState(true);
  }
});

// Mode toggle
const pkModeBtn = $('pk-mode') as HTMLButtonElement;
function setPkMode(mode: StreamMode): void {
  pkStreamer.mode = mode;
  pkModeBtn.dataset.mode = mode;
  pkModeBtn.querySelector('strong')!.textContent = mode;
}
pkModeBtn.addEventListener('click', () => {
  setPkMode(pkStreamer.mode === 'instant' ? 'lazy' : 'instant');
});

// Width toggle
$('pk-width').addEventListener('click', () => {
  pkMeterWith.markExpected(400);
  pkMeterWithout.markExpected(400);
  root.classList.toggle('wide-cols');
});

// Quick webfont swap (single toggle: system serif → Source Serif 4 and back).
const pkFontBtn = $('pk-font') as HTMLButtonElement;
const pkSelections: FontSelections = { ...DEFAULT_SELECTIONS };
pkFontBtn.addEventListener('click', async () => {
  const on = pkFontBtn.dataset.on === '1';
  pkSelections.serif = on ? 'system' : 'source-serif-4';
  pkSelections.sans = on ? 'system' : 'inter';
  pkFontBtn.dataset.on = on ? '0' : '1';
  applyFontVars(root, pkSelections);
  pkMeterWith.markExpected(800);
  pkMeterWithout.markExpected(800);
  try {
    await loadFonts(pkSelections);
  } catch {
    /* network failure — system fallbacks remain */
  }
  window.__vitePretext?.remeasureAll();
});

// Reset
$('pk-reset').addEventListener('click', () => {
  pkStreamer.stop();
  setPkStreamState(false);
  while (pkFeedWith.children.length > pkInitial.length) pkFeedWith.firstChild?.remove();
  while (pkFeedWithout.children.length > pkInitial.length) pkFeedWithout.firstChild?.remove();
  pkStreamer.count = 0;
  pkMeterWith.reset();
  pkMeterWithout.reset();
  requestAnimationFrame(() => requestAnimationFrame(pkBaseline));
});

// ── ③ FPS modal ─────────────────────────────────────────────────────────────
const fpsModal = $('fps-modal');
const fpsTest = new FpsTest(fpsModal);
const fpsBtn = $('btn-fps') as HTMLButtonElement;
fpsBtn.addEventListener('click', () => {
  const wasStreaming = pkStreamer.isRunning;
  if (wasStreaming) {
    pkStreamer.stop();
    setPkStreamState(false);
  }
  fpsTest.open(() => {
    if (wasStreaming) {
      pkStreamer.start(220);
      setPkStreamState(true);
    }
  });
});

function openFpsFromHash(): void {
  if (window.location.hash !== '#fps') return;
  if (!fpsModal.hidden) return;
  fpsBtn.click();
}
openFpsFromHash();
window.addEventListener('hashchange', openFpsFromHash);

// ── Copy-install button ──────────────────────────────────────────────────────
const copyBtn = $('copy-install') as HTMLButtonElement;
copyBtn.addEventListener('click', async () => {
  const text = copyBtn.dataset.install ?? '';
  try {
    await navigator.clipboard.writeText(text);
    const code = copyBtn.querySelector('code')!;
    const prev = code.textContent;
    code.textContent = 'copied ✓';
    window.setTimeout(() => (code.textContent = prev), 1200);
  } catch {
    /* clipboard unavailable — no-op */
  }
});
