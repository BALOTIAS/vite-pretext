import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearMeasurement,
  getMeasurement,
  observe,
  observeAll,
  recordMeasurement,
} from '../src/measurements.js';
import type { Measurement } from '../src/types.js';

function fresh(): HTMLElement {
  const el = document.createElement('p');
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('recordMeasurement', () => {
  it('caches the measurement so getMeasurement returns it', () => {
    const el = fresh();
    expect(getMeasurement(el)).toBeUndefined();
    const m: Measurement = { height: 100, lineCount: 4 };
    recordMeasurement(el, 'height', m);
    expect(getMeasurement(el)).toEqual(m);
  });

  it('writes CSS variables for mode "height"', () => {
    const el = fresh();
    recordMeasurement(el, 'height', { height: 120, lineCount: 5 });
    expect(el.style.getPropertyValue('--pretext-mode')).toBe('height');
    expect(el.style.getPropertyValue('--pretext-height')).toBe('120');
    expect(el.style.getPropertyValue('--pretext-line-count')).toBe('5');
  });

  it('writes natural-width and max-line-width vars for mode "width"', () => {
    const el = fresh();
    recordMeasurement(el, 'width', {
      height: 30,
      lineCount: 1,
      naturalWidth: 240,
      maxLineWidth: 240,
    });
    expect(el.style.getPropertyValue('--pretext-mode')).toBe('width');
    expect(el.style.getPropertyValue('--pretext-natural-width')).toBe('240');
    expect(el.style.getPropertyValue('--pretext-max-line-width')).toBe('240');
  });

  it('writes only line-count for mode "lines"', () => {
    const el = fresh();
    recordMeasurement(el, 'lines', { height: 40, lineCount: 2 });
    expect(el.style.getPropertyValue('--pretext-mode')).toBe('lines');
    expect(el.style.getPropertyValue('--pretext-line-count')).toBe('2');
  });

  it('skips CSS variables entirely for mode "none"', () => {
    const el = fresh();
    recordMeasurement(el, 'none', { height: 80, lineCount: 3 });
    expect(el.style.getPropertyValue('--pretext-mode')).toBe('');
    expect(el.style.getPropertyValue('--pretext-height')).toBe('');
    expect(el.style.getPropertyValue('--pretext-line-count')).toBe('');
  });

  it('dispatches a `pretext:measured` event with the measurement detail', () => {
    const el = fresh();
    const fn = vi.fn();
    el.addEventListener('pretext:measured', (e) => fn((e as CustomEvent<Measurement>).detail));
    const m: Measurement = { height: 100, lineCount: 4 };
    recordMeasurement(el, 'height', m);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(m);
  });

  it('still dispatches the event for mode "none"', () => {
    const el = fresh();
    const fn = vi.fn();
    el.addEventListener('pretext:measured', (e) => fn((e as CustomEvent<Measurement>).detail));
    recordMeasurement(el, 'none', { height: 0, lineCount: 0 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('the dispatched event bubbles', () => {
    const parent = document.createElement('div');
    const child = document.createElement('p');
    parent.appendChild(child);
    document.body.appendChild(parent);
    const fn = vi.fn();
    parent.addEventListener('pretext:measured', fn);
    recordMeasurement(child, 'height', { height: 1, lineCount: 1 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('notifies global observers', () => {
    const el = fresh();
    const fn = vi.fn();
    const off = observeAll(fn);
    recordMeasurement(el, 'height', { height: 1, lineCount: 1 });
    expect(fn).toHaveBeenCalledWith(el, { height: 1, lineCount: 1 });
    off();
  });
});

describe('observe', () => {
  it('subscribes and fires on the next measurement', () => {
    const el = fresh();
    const fn = vi.fn();
    observe(el, fn);
    recordMeasurement(el, 'height', { height: 50, lineCount: 2 });
    expect(fn).toHaveBeenCalledWith({ height: 50, lineCount: 2 });
  });

  it('returns an unsubscribe that stops further callbacks', () => {
    const el = fresh();
    const fn = vi.fn();
    const off = observe(el, fn);
    recordMeasurement(el, 'height', { height: 50, lineCount: 2 });
    off();
    recordMeasurement(el, 'height', { height: 60, lineCount: 3 });
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('observeAll', () => {
  it('fires for every recorded element', () => {
    const a = fresh();
    const b = fresh();
    const fn = vi.fn();
    const off = observeAll(fn);
    recordMeasurement(a, 'height', { height: 10, lineCount: 1 });
    recordMeasurement(b, 'width', { height: 20, lineCount: 1, naturalWidth: 120 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, a, expect.objectContaining({ height: 10 }));
    expect(fn).toHaveBeenNthCalledWith(2, b, expect.objectContaining({ naturalWidth: 120 }));
    off();
  });

  it('returns an unsubscribe', () => {
    const el = fresh();
    const fn = vi.fn();
    const off = observeAll(fn);
    off();
    recordMeasurement(el, 'height', { height: 1, lineCount: 1 });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('clearMeasurement', () => {
  it('drops the cache entry and removes CSS variables', () => {
    const el = fresh();
    recordMeasurement(el, 'height', { height: 100, lineCount: 4 });
    expect(getMeasurement(el)).toBeDefined();
    expect(el.style.getPropertyValue('--pretext-height')).toBe('100');
    clearMeasurement(el);
    expect(getMeasurement(el)).toBeUndefined();
    expect(el.style.getPropertyValue('--pretext-height')).toBe('');
    expect(el.style.getPropertyValue('--pretext-mode')).toBe('');
  });
});
