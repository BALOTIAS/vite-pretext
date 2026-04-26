import { afterEach, describe, expect, it } from 'vitest';
import { applyResult } from '../src/apply.js';

function fresh(tag = 'p'): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

// applyResult queues its writes in a microtask. await-ing a resolved
// Promise drains the microtask queue, which is enough to observe the
// effect.
const flush = () => Promise.resolve();

afterEach(() => {
  document.body.innerHTML = '';
});

describe('applyResult — mode dispatch', () => {
  it('mode "height" + applyStyles=true sets inline min-height', async () => {
    const el = fresh();
    applyResult(el, 'height', true, { height: 120, lineCount: 5 });
    await flush();
    expect(el.style.minHeight).toBe('120px');
    expect(el.style.width).toBe('');
  });

  it('mode "width" + applyStyles=true sets inline width', async () => {
    const el = fresh();
    applyResult(el, 'width', true, { naturalWidth: 200 });
    await flush();
    expect(el.style.width).toBe('200px');
    expect(el.style.minHeight).toBe('');
  });

  it('mode "lines" never writes inline styles, even with applyStyles=true', async () => {
    const el = fresh();
    applyResult(el, 'lines', true, { height: 100, lineCount: 3 });
    await flush();
    expect(el.style.minHeight).toBe('');
    expect(el.style.width).toBe('');
  });

  it('mode "none" never writes inline styles, even with applyStyles=true', async () => {
    const el = fresh();
    applyResult(el, 'none', true, { height: 100, lineCount: 3 });
    await flush();
    expect(el.style.minHeight).toBe('');
    expect(el.style.width).toBe('');
  });
});

describe('applyResult — applyStyles=false suppresses inline styles', () => {
  it('mode "height" + applyStyles=false does not set min-height', async () => {
    const el = fresh();
    applyResult(el, 'height', false, { height: 120, lineCount: 5 });
    await flush();
    expect(el.style.minHeight).toBe('');
  });

  it('mode "width" + applyStyles=false does not set width', async () => {
    const el = fresh();
    applyResult(el, 'width', false, { naturalWidth: 200 });
    await flush();
    expect(el.style.width).toBe('');
  });

  it('still adds the pretext-hydrated class with applyStyles=false', async () => {
    const el = fresh();
    applyResult(el, 'height', false, { height: 120 });
    await flush();
    expect(el.classList.contains('pretext-hydrated')).toBe(true);
  });
});

describe('applyResult — pretext-hydrated class', () => {
  it('is added in every mode', async () => {
    for (const mode of ['height', 'width', 'lines', 'none'] as const) {
      const el = fresh();
      applyResult(el, mode, true, { height: 10, naturalWidth: 10 });
      await flush();
      expect(el.classList.contains('pretext-hydrated'), `mode=${mode}`).toBe(true);
    }
  });
});

describe('applyResult — width chrome calculation', () => {
  it('adds horizontal padding + border to the natural width', async () => {
    const el = fresh('button');
    el.style.padding = '10px 20px';
    el.style.border = '2px solid black';
    applyResult(el, 'width', true, { naturalWidth: 100 });
    await flush();
    // 100 (content) + 20 + 20 (padding L+R) + 2 + 2 (border L+R) = 144
    expect(el.style.width).toBe('144px');
  });

  it('handles zero padding and border (no chrome)', async () => {
    const el = fresh();
    applyResult(el, 'width', true, { naturalWidth: 80 });
    await flush();
    expect(el.style.width).toBe('80px');
  });

  it('rounds the final pixel value up via Math.ceil', async () => {
    const el = fresh();
    applyResult(el, 'width', true, { naturalWidth: 100.1 });
    await flush();
    expect(el.style.width).toBe('101px');
  });
});

describe('applyResult — missing measurement values', () => {
  it('mode "height" with no height does not write min-height', async () => {
    const el = fresh();
    applyResult(el, 'height', true, { lineCount: 3 });
    await flush();
    expect(el.style.minHeight).toBe('');
    // hydrated class is still added — measurement happened, just nothing to apply
    expect(el.classList.contains('pretext-hydrated')).toBe(true);
  });

  it('mode "width" with no naturalWidth does not write width', async () => {
    const el = fresh();
    applyResult(el, 'width', true, { height: 30, lineCount: 1 });
    await flush();
    expect(el.style.width).toBe('');
    expect(el.classList.contains('pretext-hydrated')).toBe(true);
  });
});

describe('applyResult — microtask deferral', () => {
  it('does not apply styles synchronously', () => {
    const el = fresh();
    applyResult(el, 'height', true, { height: 120 });
    // Before the microtask drains, nothing has been written.
    expect(el.style.minHeight).toBe('');
    expect(el.classList.contains('pretext-hydrated')).toBe(false);
  });

  it('applies styles after the microtask queue drains', async () => {
    const el = fresh();
    applyResult(el, 'height', true, { height: 120 });
    await flush();
    expect(el.style.minHeight).toBe('120px');
    expect(el.classList.contains('pretext-hydrated')).toBe(true);
  });
});
