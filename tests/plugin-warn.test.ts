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
    expect(offsetHeightWarning?.message).toMatch(/style\.minHeight/);
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
});
