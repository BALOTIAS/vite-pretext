// Shared font catalogue + Google-Fonts loader used by the FPS modal and the
// streaming bar. Each slot (sans / serif / mono) defaults to the system
// stack and offers a small set of Google webfonts as alternatives.

export type FontSlot = 'sans' | 'serif' | 'mono';

export interface FontOption {
  value: string; // unique identifier in the <select>
  label: string; // user-visible label
  family?: string; // CSS font-family (without quotes); undefined = system
  google?: { name: string; weights: string }; // Google-Fonts URL fragment
}

export const FONT_OPTIONS: Record<FontSlot, FontOption[]> = {
  sans: [
    { value: 'system', label: 'system' },
    { value: 'inter', label: 'Inter', family: 'Inter', google: { name: 'Inter', weights: '400;600;700' } },
    { value: 'roboto', label: 'Roboto', family: 'Roboto', google: { name: 'Roboto', weights: '400;500;700' } },
    { value: 'open-sans', label: 'Open Sans', family: 'Open Sans', google: { name: 'Open Sans', weights: '400;600;700' } },
    { value: 'manrope', label: 'Manrope', family: 'Manrope', google: { name: 'Manrope', weights: '400;600;700' } },
  ],
  serif: [
    { value: 'system', label: 'system' },
    { value: 'source-serif-4', label: 'Source Serif 4', family: 'Source Serif 4', google: { name: 'Source Serif 4', weights: '400;700' } },
    { value: 'playfair-display', label: 'Playfair Display', family: 'Playfair Display', google: { name: 'Playfair Display', weights: '400;700' } },
    { value: 'merriweather', label: 'Merriweather', family: 'Merriweather', google: { name: 'Merriweather', weights: '400;700' } },
    { value: 'lora', label: 'Lora', family: 'Lora', google: { name: 'Lora', weights: '400;700' } },
  ],
  mono: [
    { value: 'system', label: 'system' },
    { value: 'jetbrains-mono', label: 'JetBrains Mono', family: 'JetBrains Mono', google: { name: 'JetBrains Mono', weights: '400;700' } },
    { value: 'fira-code', label: 'Fira Code', family: 'Fira Code', google: { name: 'Fira Code', weights: '400;700' } },
    { value: 'source-code-pro', label: 'Source Code Pro', family: 'Source Code Pro', google: { name: 'Source Code Pro', weights: '400;700' } },
    { value: 'ibm-plex-mono', label: 'IBM Plex Mono', family: 'IBM Plex Mono', google: { name: 'IBM Plex Mono', weights: '400;700' } },
  ],
};

export interface FontSelections {
  sans: string;
  serif: string;
  mono: string;
}

export const DEFAULT_SELECTIONS: FontSelections = { sans: 'system', serif: 'system', mono: 'system' };

const SYSTEM_FALLBACK: Record<FontSlot, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: '"Iowan Old Style", "Charter", Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, "Menlo", "Consolas", monospace',
};

function findOption(slot: FontSlot, value: string): FontOption {
  return FONT_OPTIONS[slot].find((o) => o.value === value) ?? FONT_OPTIONS[slot][0]!;
}

export function familyStack(slot: FontSlot, value: string): string {
  const opt = findOption(slot, value);
  if (opt.family) return `'${opt.family}', ${SYSTEM_FALLBACK[slot]}`;
  return SYSTEM_FALLBACK[slot];
}

const loadedUrls = new Set<string>();

// Build a single gstatic URL for the selected webfonts and await them.
// System-only selections short-circuit; the same selection re-issued is
// idempotent (the link tag is only added once).
export async function loadFonts(selections: FontSelections): Promise<void> {
  const families: string[] = [];
  const seen = new Set<string>();
  for (const slot of ['sans', 'serif', 'mono'] as const) {
    const opt = findOption(slot, selections[slot]);
    if (opt.google && !seen.has(opt.google.name)) {
      seen.add(opt.google.name);
      const name = opt.google.name.replace(/ /g, '+');
      families.push(`family=${name}:wght@${opt.google.weights}`);
    }
  }
  if (families.length === 0) return;
  const url = `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
  if (!loadedUrls.has(url)) {
    loadedUrls.add(url);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }
  if (document.fonts) await document.fonts.ready;
}

// Populate a <select> with the options for one slot.
export function populateSelect(select: HTMLSelectElement, slot: FontSlot, value = 'system'): void {
  select.innerHTML = '';
  for (const opt of FONT_OPTIONS[slot]) {
    const optionEl = document.createElement('option');
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    select.appendChild(optionEl);
  }
  select.value = value;
}

// Apply the selected fonts to a target element by setting the three
// CSS variables the existing card styles consume. Use on :root for global,
// on a scoped container (e.g. .fps-content) for local.
export function applyFontVars(target: HTMLElement, selections: FontSelections): void {
  target.style.setProperty('--font-stack', familyStack('sans', selections.sans));
  target.style.setProperty('--font-display', familyStack('serif', selections.serif));
  target.style.setProperty('--font-mono', familyStack('mono', selections.mono));
}
