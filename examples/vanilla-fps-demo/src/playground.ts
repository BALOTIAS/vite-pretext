import { buildCssVarsShowcase, buildInitial } from './feed.js';
import { installMeasurementBadges } from './measurement-badges.js';
import {
  applyFontVars,
  DEFAULT_SELECTIONS,
  loadFonts,
  populateSelect,
  type FontSelections,
  type FontSlot,
} from './fonts.js';
import type { Measurement } from 'vite-pretext';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const root = document.documentElement;

// ── lines-mode resizable showcase ────────────────────────────────────────────
const linesHost = $('pg-lines-host');
linesHost.appendChild(buildCssVarsShowcase());

// ── none-mode readout via the pretext:measured event ─────────────────────────
const noneEl = $('pg-none');
const noneReadout = $('pg-none-readout');
noneEl.addEventListener('pretext:measured', (e) => {
  const m = (e as CustomEvent<Measurement>).detail;
  noneReadout.textContent = `height ${Math.round(m.height ?? 0)}px · ${m.lineCount ?? 0} lines`;
});

// ── measurement chips ────────────────────────────────────────────────────────
installMeasurementBadges();
// One batch of demo cards; distinct slices feed the two sections below.
const pgCards = buildInitial();
const chipsFeed = $('pg-chips-feed');
for (const pair of pgCards.slice(0, 5)) chipsFeed.appendChild(pair.withNode);

const chipsToggle = $('pg-chips-toggle') as HTMLButtonElement;
chipsToggle.addEventListener('click', () => {
  const on = root.classList.toggle('show-measurements');
  chipsToggle.dataset.active = on ? '1' : '0';
  chipsToggle.textContent = on ? '📏 Hide measurements' : '📏 Show measurements';
});

// ── webfont swap ─────────────────────────────────────────────────────────────
const fontsFeed = $('pg-fonts-feed');
for (const pair of pgCards.slice(5, 9)) fontsFeed.appendChild(pair.withNode);

const fontSelects: Record<FontSlot, HTMLSelectElement> = {
  sans: $('pg-font-sans') as HTMLSelectElement,
  serif: $('pg-font-serif') as HTMLSelectElement,
  mono: $('pg-font-mono') as HTMLSelectElement,
};
const selections: FontSelections = { ...DEFAULT_SELECTIONS };
for (const slot of ['sans', 'serif', 'mono'] as const) {
  populateSelect(fontSelects[slot], slot, selections[slot]);
  fontSelects[slot].addEventListener('change', async () => {
    selections[slot] = fontSelects[slot].value;
    applyFontVars(root, selections);
    try {
      await loadFonts(selections);
    } catch {
      /* network failure — system fallbacks remain */
    }
    window.__vitePretext?.remeasureAll();
  });
}
