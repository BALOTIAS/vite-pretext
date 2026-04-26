// Subscribe to the `pretext:measured` DOM event and stamp a small chip of
// measurement data onto each measured element. Toggleable via a class on
// the root element so the chips don't permanently clutter the demo.
//
// Implementation note: we write the chip to a `data-pt-info` attribute and
// render it via a CSS `::after` pseudo. Inserting a real child element
// would contaminate `textContent`, which pretext re-reads on every
// re-measurement — corrupting subsequent measurements. Pseudo-elements
// are not part of textContent, so this approach is measurement-safe.

import type { Measurement } from 'vite-pretext';

function format(m: Measurement): string {
  const parts: string[] = [];
  if (m.naturalWidth != null) parts.push(`${Math.round(m.naturalWidth)}w`);
  if (m.height != null) parts.push(`${Math.round(m.height)}h`);
  if (m.lineCount != null) parts.push(`${m.lineCount}L`);
  return parts.join(' · ') || '—';
}

export function installMeasurementBadges(): void {
  document.addEventListener('pretext:measured', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const detail = (e as CustomEvent<Measurement>).detail;
    target.setAttribute('data-pt-info', format(detail));
  });
}
