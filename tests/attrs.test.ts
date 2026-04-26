import { describe, expect, it } from 'vitest';
import { autoLetterSpacing, readMarkerAttrs } from '../src/attrs.js';

function el(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html.trim();
  return host.firstElementChild as HTMLElement;
}

describe('readMarkerAttrs', () => {
  it('returns mode "height" by default', () => {
    expect(readMarkerAttrs(el('<p data-pretext></p>')).mode).toBe('height');
  });

  it('parses every valid mode', () => {
    expect(readMarkerAttrs(el('<p data-pretext data-pretext-mode="height"></p>')).mode).toBe(
      'height',
    );
    expect(readMarkerAttrs(el('<p data-pretext data-pretext-mode="width"></p>')).mode).toBe(
      'width',
    );
    expect(readMarkerAttrs(el('<p data-pretext data-pretext-mode="lines"></p>')).mode).toBe(
      'lines',
    );
    expect(readMarkerAttrs(el('<p data-pretext data-pretext-mode="none"></p>')).mode).toBe(
      'none',
    );
  });

  it('falls back to "height" for unknown mode values', () => {
    expect(readMarkerAttrs(el('<p data-pretext data-pretext-mode="bogus"></p>')).mode).toBe(
      'height',
    );
    expect(readMarkerAttrs(el('<p data-pretext data-pretext-mode=""></p>')).mode).toBe('height');
  });

  it('reads data-pretext-text as the text override', () => {
    const a = readMarkerAttrs(el('<p data-pretext data-pretext-text="Hello world."></p>'));
    expect(a.text).toBe('Hello world.');
  });

  it('treats empty data-pretext-text as absent', () => {
    expect(readMarkerAttrs(el('<p data-pretext data-pretext-text=""></p>')).text).toBeUndefined();
  });

  it('ignores data-pretext-text when not set', () => {
    expect(readMarkerAttrs(el('<p data-pretext>x</p>')).text).toBeUndefined();
  });

  it('parses data-pretext-white-space="pre-wrap"', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-white-space="pre-wrap"></p>')).whiteSpace,
    ).toBe('pre-wrap');
  });

  it('ignores other white-space values', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-white-space="normal"></p>')).whiteSpace,
    ).toBeUndefined();
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-white-space="bogus"></p>')).whiteSpace,
    ).toBeUndefined();
  });

  it('parses data-pretext-word-break="keep-all"', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-word-break="keep-all"></p>')).wordBreak,
    ).toBe('keep-all');
  });

  it('ignores other word-break values', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-word-break="break-word"></p>')).wordBreak,
    ).toBeUndefined();
  });

  it('parses numeric data-pretext-letter-spacing', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-letter-spacing="2"></p>')).letterSpacing,
    ).toBe(2);
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-letter-spacing="-0.5"></p>'))
        .letterSpacing,
    ).toBe(-0.5);
  });

  it('ignores non-numeric letter-spacing values', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-letter-spacing="wide"></p>'))
        .letterSpacing,
    ).toBeUndefined();
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-letter-spacing=""></p>')).letterSpacing,
    ).toBeUndefined();
  });

  it('combines multiple attributes correctly', () => {
    const a = readMarkerAttrs(
      el(
        '<p data-pretext data-pretext-mode="width" data-pretext-text="X" data-pretext-letter-spacing="1.5"></p>',
      ),
    );
    expect(a).toEqual({
      mode: 'width',
      text: 'X',
      letterSpacing: 1.5,
      whiteSpace: undefined,
      wordBreak: undefined,
      applyStyles: undefined,
    });
  });

  it('parses data-pretext-apply-styles="false"', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-apply-styles="false"></p>')).applyStyles,
    ).toBe(false);
  });

  it('parses data-pretext-apply-styles="true"', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-apply-styles="true"></p>')).applyStyles,
    ).toBe(true);
  });

  it('returns undefined applyStyles for unknown values (so config can win)', () => {
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-apply-styles="bogus"></p>'))
        .applyStyles,
    ).toBeUndefined();
    expect(
      readMarkerAttrs(el('<p data-pretext data-pretext-apply-styles=""></p>')).applyStyles,
    ).toBeUndefined();
    expect(readMarkerAttrs(el('<p data-pretext></p>')).applyStyles).toBeUndefined();
  });
});

describe('autoLetterSpacing', () => {
  it('returns undefined for "normal"', () => {
    const fake = { letterSpacing: 'normal' } as CSSStyleDeclaration;
    expect(autoLetterSpacing(fake)).toBeUndefined();
  });

  it('returns undefined for zero', () => {
    const fake = { letterSpacing: '0px' } as CSSStyleDeclaration;
    expect(autoLetterSpacing(fake)).toBeUndefined();
  });

  it('returns the numeric px value for non-zero', () => {
    const fake = { letterSpacing: '2.5px' } as CSSStyleDeclaration;
    expect(autoLetterSpacing(fake)).toBe(2.5);
  });

  it('returns undefined for unparseable values', () => {
    const fake = { letterSpacing: '' } as CSSStyleDeclaration;
    expect(autoLetterSpacing(fake)).toBeUndefined();
  });
});
