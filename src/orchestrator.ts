// Track measurement history per element to detect A -> B -> A oscillations.
// We keep the last 3 measurements. If a new measurement equals the one 2 steps ago
// but differs from the last one, we skip applying it to break the loop.
const historyMap = new WeakMap<Element, string[]>();

function serializeMeasurement(m: Measurement): string {
  return [m.height, m.lineCount, m.naturalWidth, m.maxLineWidth].join("|");
}

import type {
  MeasureRequest,
  MeasureResponse,
  Measurement,
  OutputMode,
  VitePretextConfig,
} from "./types.js";
import { buildTagSets, resolveTargets } from "./walk.js";
import { autoLetterSpacing, readMarkerAttrs } from "./attrs.js";
import { applyResult } from "./apply.js";
import {
  clearMeasurement,
  getMeasurement,
  observe,
  observeAll,
  recordMeasurement,
} from "./measurements.js";

const DEFAULT_CONFIG: VitePretextConfig = {
  fallbacks: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "16px",
    lineHeight: "1.5",
  },
  applyStyles: true,
  tags: { textLeaf: [], block: [] },
};

const config: VitePretextConfig =
  window.__VITE_PRETEXT_CONFIG__ ?? DEFAULT_CONFIG;
const tagSets = buildTagSets(config.tags);

const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
});

interface PendingEntry {
  el: Element;
  mode: OutputMode;
  applyStyles: boolean;
}

const pendingMap = new Map<string, PendingEntry>();
const initialized = new WeakSet<Element>();
let enabled = true;
let completedCount = 0;
let lastMeasureMs = 0;
let measureStart = 0;

worker.addEventListener("message", (ev: MessageEvent<MeasureResponse>) => {
  const { id, height, lineCount, naturalWidth, maxLineWidth } = ev.data;
  const entry = pendingMap.get(id);
  pendingMap.delete(id);
  if (!entry) return;
  if (!enabled) return;

  const measurement: Measurement = {
    height,
    lineCount,
    naturalWidth,
    maxLineWidth,
  };
  const serialized = serializeMeasurement(measurement);

  let history = historyMap.get(entry.el);
  if (!history) {
    history = [];
    historyMap.set(entry.el, history);
  }

  // Oscillation detection: A -> B -> A
  if (history.length >= 2) {
    const prev = history[history.length - 1];
    const prevPrev = history[history.length - 2];

    if (serialized === prevPrev && serialized !== prev) {
      // Oscillation detected!
      // Skip applying and recording to break the feedback loop.
      // But we still record this in history so we can recover if the user intentionally resizes
      // to a completely new state C.
      history.push(serialized);
      if (history.length > 3) history.shift();
      return;
    }
  }

  history.push(serialized);
  if (history.length > 3) history.shift();

  completedCount++;
  lastMeasureMs = performance.now() - measureStart;

  applyResult(
    entry.el as HTMLElement,
    entry.mode,
    entry.applyStyles,
    measurement,
  );
  recordMeasurement(entry.el, entry.mode, measurement);
});

function buildFontString(style: CSSStyleDeclaration): string {
  const family = style.fontFamily || config.fallbacks.fontFamily;
  const size = style.fontSize || config.fallbacks.fontSize;
  const weight = style.fontWeight || "normal";
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
  const attrs = readMarkerAttrs(el);
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  // Per-element override wins; otherwise inherit from the plugin config.
  const applyStyles = attrs.applyStyles ?? config.applyStyles;
  pendingMap.set(id, { el, mode: attrs.mode, applyStyles });
  measureStart = performance.now();
  const req: MeasureRequest = {
    id,
    text: attrs.text ?? el.textContent ?? "",
    font: buildFontString(style),
    lineHeight: resolveLineHeight(style),
    width: el.clientWidth,
    mode: attrs.mode,
    whiteSpace: attrs.whiteSpace,
    wordBreak: attrs.wordBreak,
    letterSpacing: attrs.letterSpacing ?? autoLetterSpacing(style),
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
  el.classList.add("pretext-init");
  processText(el);
  resizeObserver.observe(el);
}

function discoverAll(): void {
  document.querySelectorAll<HTMLElement>("[data-pretext]").forEach((root) => {
    for (const el of resolveTargets(root, tagSets)) initElement(el);
  });
}

const mutationObserver = new MutationObserver(() => discoverAll());

function start(): void {
  mutationObserver.observe(document.body, { childList: true, subtree: true });
  discoverAll();
  document.fonts?.ready.then(() => {
    document.querySelectorAll(".pretext-init").forEach((el) => processText(el));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}

window.__vitePretext = {
  setEnabled(value: boolean) {
    if (enabled === value) return;
    enabled = value;
    if (!enabled) {
      // Honest off: drop reserved styles so the page reflows like any
      // un-pretexted page. Re-enabling triggers a fresh measurement.
      document.querySelectorAll<HTMLElement>(".pretext-init").forEach((el) => {
        el.style.minHeight = "";
        el.style.width = "";
        el.classList.remove("pretext-hydrated");
        clearMeasurement(el);
      });
    } else {
      window.__vitePretext?.remeasureAll();
    }
  },
  remeasureAll() {
    if (!enabled) return;
    document.querySelectorAll(".pretext-init").forEach((el) => processText(el));
  },
  getStats() {
    return {
      pendingCount: pendingMap.size,
      completedCount,
      lastMeasureMs,
    };
  },
  getMeasurement,
  observe,
  observeAll,
};
