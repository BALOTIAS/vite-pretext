import type { MeasureRequest, MeasureResponse, VitePretextConfig } from './types.js';
import { resolveTargets } from './walk.js';

const DEFAULT_CONFIG: VitePretextConfig = {
  fallbacks: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: '16px',
    lineHeight: '1.5',
  },
};

const config: VitePretextConfig = window.__VITE_PRETEXT_CONFIG__ ?? DEFAULT_CONFIG;

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

const pendingMap = new Map<string, Element>();
const initialized = new WeakSet<Element>();
let enabled = true;
let completedCount = 0;
let lastMeasureMs = 0;
let measureStart = 0;

worker.addEventListener('message', (ev: MessageEvent<MeasureResponse>) => {
  const { id, height } = ev.data;
  const el = pendingMap.get(id);
  pendingMap.delete(id);
  if (!el) return;
  if (!enabled) return;
  completedCount++;
  lastMeasureMs = performance.now() - measureStart;
  applyHeight(el as HTMLElement, height);
});

function applyHeight(el: HTMLElement, height: number): void {
  // queueMicrotask sidesteps SSR hydration mismatch (RFC edge case 3).
  queueMicrotask(() => {
    el.style.minHeight = height + 'px';
    el.classList.add('pretext-hydrated');
  });
}

function buildFontString(style: CSSStyleDeclaration): string {
  const family = style.fontFamily || config.fallbacks.fontFamily;
  const size = style.fontSize || config.fallbacks.fontSize;
  const weight = style.fontWeight || 'normal';
  return `${weight} ${size} ${family}`;
}

function resolveLineHeight(style: CSSStyleDeclaration): number {
  const lh = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lh)) return lh;
  const fs = Number.parseFloat(style.fontSize) || 16;
  return fs * 1.5;
}

const intersectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting && entry.target.clientWidth > 0) {
      intersectionObserver.unobserve(entry.target);
      processText(entry.target);
    }
  }
});

function processText(el: Element): void {
  if (!enabled) return;
  if (el.clientWidth === 0) {
    intersectionObserver.observe(el);
    return;
  }

  const style = window.getComputedStyle(el);
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  pendingMap.set(id, el);
  measureStart = performance.now();
  const req: MeasureRequest = {
    id,
    text: el.textContent ?? '',
    font: buildFontString(style),
    lineHeight: resolveLineHeight(style),
    width: el.clientWidth,
  };
  worker.postMessage(req);
}

const resizeQueue = new Set<Element>();
let resizeRafId: number | null = null;
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) resizeQueue.add(entry.target);
  if (resizeRafId !== null) return;
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null;
    for (const el of resizeQueue) processText(el);
    resizeQueue.clear();
  });
});

function initElement(el: Element): void {
  if (initialized.has(el)) return;
  initialized.add(el);
  el.classList.add('pretext-init');
  processText(el);
  resizeObserver.observe(el);
}

function discoverAll(): void {
  document.querySelectorAll<HTMLElement>('[data-pretext]').forEach((root) => {
    for (const el of resolveTargets(root)) initElement(el);
  });
}

const mutationObserver = new MutationObserver(() => discoverAll());

function start(): void {
  mutationObserver.observe(document.body, { childList: true, subtree: true });
  discoverAll();
  document.fonts?.ready.then(() => {
    document.querySelectorAll('.pretext-init').forEach((el) => processText(el));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}

window.__vitePretext = {
  setEnabled(value: boolean) {
    if (enabled === value) return;
    enabled = value;
    if (!enabled) {
      // Honest off: drop reserved min-heights so the column reflows like any
      // un-pretexted page. Re-enabling triggers a fresh measurement.
      document.querySelectorAll<HTMLElement>('.pretext-init').forEach((el) => {
        el.style.minHeight = '';
        el.classList.remove('pretext-hydrated');
      });
    } else {
      window.__vitePretext?.remeasureAll();
    }
  },
  remeasureAll() {
    if (!enabled) return;
    document.querySelectorAll('.pretext-init').forEach((el) => processText(el));
  },
  getStats() {
    return {
      pendingCount: pendingMap.size,
      completedCount,
      lastMeasureMs,
    };
  },
};
