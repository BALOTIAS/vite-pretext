// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { build, type Rollup } from 'vite';
import { vitePretext } from '../src/index.js';
import { setupFixture, type Fixture } from './helpers.js';

type BuildOutput = Rollup.RollupOutput;

let fixture: Fixture | null = null;
afterEach(async () => {
  if (fixture) {
    await fixture.cleanup();
    fixture = null;
  }
});

interface CapturedWarning {
  message: string;
  api?: string;
  loc?: { file?: string; line?: number; column?: number };
}

async function runBuildAndCaptureWarnings(plugins = [vitePretext()]): Promise<{
  output: BuildOutput;
  warnings: CapturedWarning[];
}> {
  if (!fixture) throw new Error('fixture not set up');
  const warnings: CapturedWarning[] = [];
  const result = (await build({
    root: fixture.dir,
    configFile: false,
    logLevel: 'silent',
    plugins,
    build: {
      write: false,
      modulePreload: { polyfill: false },
      rollupOptions: {
        onwarn(warning) {
          // Rolldown surfaces both string and object forms.
          if (typeof warning === 'string') {
            warnings.push({ message: warning });
          } else {
            warnings.push({
              message: warning.message ?? '',
              loc: warning.loc as CapturedWarning['loc'],
            });
          }
        },
      },
    },
  })) as BuildOutput | BuildOutput[];
  let output: BuildOutput;
  if (Array.isArray(result)) {
    const first = result[0];
    if (!first) throw new Error('build returned an empty result array');
    output = first;
  } else {
    output = result;
  }
  return { output, warnings };
}

describe('plugin (warn)', () => {
  it('warns when offsetHeight is read in user source', async () => {
    // Three explicit lines so the line-number assertion is unambiguous.
    const source = [
      'const el = document.body;',
      'const h = el.offsetHeight;',
      'console.log(h);',
    ].join('\n');

    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': source,
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const offsetHeightWarning = warnings.find((w) => w.message.includes('offsetHeight'));
    expect(offsetHeightWarning).toBeDefined();
    expect(offsetHeightWarning?.message).toMatch(/forces synchronous layout/);
    expect(offsetHeightWarning?.message).toMatch(/getMeasurement\(el\)\?\.height/);
    expect(offsetHeightWarning?.message).toMatch(/--pretext-height/);
    expect(offsetHeightWarning?.loc?.file).toMatch(/main\.ts$/);
    // offsetHeight lives on line 2 of the source above.
    expect(offsetHeightWarning?.loc?.line).toBe(2);
  });

  it('warns for getBoundingClientRect()', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': `
        const el = document.body;
        const rect = el.getBoundingClientRect();
        console.log(rect.height);
      `,
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const w = warnings.find((w) => w.message.includes('getBoundingClientRect'));
    expect(w).toBeDefined();
    expect(w?.message).toMatch(/forces synchronous layout/);
  });

  it('is silent when warn: false', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': `
        const el = document.body;
        const h = el.offsetHeight;
        const r = el.getBoundingClientRect();
        const w = el.clientWidth;
        console.log(h, r, w);
      `,
    });

    const { warnings } = await runBuildAndCaptureWarnings([vitePretext({ warn: false })]);
    const layoutWarnings = warnings.filter((w) =>
      /offsetHeight|getBoundingClientRect|clientWidth|forces synchronous layout/.test(w.message),
    );
    expect(layoutWarnings).toEqual([]);
  });

  it('warns for each occurrence (multiple matches in one file)', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': `
        const a = document.body.offsetHeight;
        const b = document.body.offsetHeight;
        const c = document.body.offsetHeight;
        console.log(a, b, c);
      `,
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const offsetHeightWarnings = warnings.filter((w) => w.message.includes('offsetHeight'));
    expect(offsetHeightWarnings.length).toBe(3);
  });

  it('warns for scrollHeight, scrollWidth, and getClientRects()', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': `
        const el = document.body;
        const sh = el.scrollHeight;
        const sw = el.scrollWidth;
        const rs = el.getClientRects();
        console.log(sh, sw, rs);
      `,
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    expect(warnings.some((w) => w.message.includes('scrollHeight'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('scrollWidth'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('getClientRects()'))).toBe(true);
  });

  it('tailors the replacement hint per matched API', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': `
        const el = document.body;
        const h = el.clientHeight;
        const w = el.clientWidth;
        const r = el.getBoundingClientRect();
        const t = el.offsetTop;
        console.log(h, w, r, t);
      `,
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const find = (api: string) => warnings.find((w) => w.message.includes(api));
    // Height-axis read → height hint.
    expect(find('clientHeight')?.message).toMatch(/getMeasurement\(el\)\?\.height/);
    // Width-axis read → naturalWidth hint.
    expect(find('clientWidth')?.message).toMatch(/getMeasurement\(el\)\?\.naturalWidth/);
    // Rect read → both-axis hint (no `?.height` suffix; backticks ignored).
    expect(find('getBoundingClientRect')?.message).toContain(
      'getMeasurement(el)` for cached width and height',
    );
    // Position read → no pretext API; rAF fallback.
    expect(find('offsetTop')?.message).toMatch(/requestAnimationFrame/);
    expect(find('offsetTop')?.message).not.toMatch(/getMeasurement/);
  });

  it('mentions the @vite-pretext-ignore escape hatch in every warning', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': `console.log(document.body.offsetHeight);`,
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const w = warnings.find((w) => w.message.includes('offsetHeight'));
    expect(w?.message).toMatch(/@vite-pretext-ignore/);
  });

  it('suppresses the warning when the same line carries // @vite-pretext-ignore', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': [
        'const el = document.body;',
        'const h = el.offsetHeight; // @vite-pretext-ignore intentional layout flush',
        'console.log(h);',
      ].join('\n'),
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const layoutWarnings = warnings.filter((w) => w.message.includes('offsetHeight'));
    expect(layoutWarnings).toEqual([]);
  });

  it('suppresses the warning when the previous line carries // @vite-pretext-ignore', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': [
        'const el = document.body;',
        '// @vite-pretext-ignore — required for the focus-ring math',
        'const h = el.offsetHeight;',
        'console.log(h);',
      ].join('\n'),
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const layoutWarnings = warnings.filter((w) => w.message.includes('offsetHeight'));
    expect(layoutWarnings).toEqual([]);
  });

  it('does NOT suppress when a blank line sits between the ignore and the read', async () => {
    // The check is "same line OR immediately preceding line" — a blank line
    // breaks the adjacency. Guards against a future refactor that scans
    // multiple lines back.
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': [
        'const el = document.body;',
        '// @vite-pretext-ignore',
        '',
        'const h = el.offsetHeight;',
        'console.log(h);',
      ].join('\n'),
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const layoutWarnings = warnings.filter((w) => w.message.includes('offsetHeight'));
    expect(layoutWarnings.length).toBe(1);
    expect(layoutWarnings[0]?.loc?.line).toBe(4);
  });

  it('only suppresses the immediately following match — not every later read', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': [
        'const el = document.body;',
        '// @vite-pretext-ignore',
        'const a = el.offsetHeight;',
        '',
        'const b = el.offsetHeight;',
        'console.log(a, b);',
      ].join('\n'),
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const layoutWarnings = warnings.filter((w) => w.message.includes('offsetHeight'));
    expect(layoutWarnings.length).toBe(1);
    // The surviving warning is the second offsetHeight read on line 5.
    expect(layoutWarnings[0]?.loc?.line).toBe(5);
  });

  it('supports /* @vite-pretext-ignore */ block-comment syntax on the same line', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><script type="module" src="/src/main.ts"></script></body></html>`,
      'src/main.ts': [
        'const el = document.body;',
        'const h = /* @vite-pretext-ignore */ el.offsetHeight;',
        'console.log(h);',
      ].join('\n'),
    });

    const { warnings } = await runBuildAndCaptureWarnings();
    const layoutWarnings = warnings.filter((w) => w.message.includes('offsetHeight'));
    expect(layoutWarnings).toEqual([]);
  });
});
