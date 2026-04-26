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

async function runBuild(plugins = [vitePretext()]): Promise<BuildOutput> {
  if (!fixture) throw new Error('fixture not set up');
  const result = (await build({
    root: fixture.dir,
    configFile: false,
    logLevel: 'silent',
    plugins,
    build: {
      write: false,
      // Skip module preload polyfills to keep the output minimal/predictable.
      modulePreload: { polyfill: false },
    },
  })) as BuildOutput | BuildOutput[];
  if (Array.isArray(result)) {
    const first = result[0];
    if (!first) throw new Error('build returned an empty result array');
    return first;
  }
  return result;
}

function findHtml(output: BuildOutput) {
  return output.output.find(
    (o) => o.type === 'asset' && o.fileName.endsWith('.html'),
  ) as { type: 'asset'; fileName: string; source: string | Uint8Array } | undefined;
}

function findBootstrapChunk(output: BuildOutput) {
  return output.output.find(
    (o) => o.type === 'chunk' && o.name === 'vite-pretext-bootstrap',
  );
}

describe('plugin (build)', () => {
  it('emits a bootstrap chunk and injects the script when the marker is in HTML', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <p data-pretext>Reserve me.</p>
  <script type="module" src="/src/main.ts"></script>
</body></html>`,
      'src/main.ts': `console.log('hello')`,
    });

    const out = await runBuild();
    const html = findHtml(out);
    const bootstrap = findBootstrapChunk(out);

    expect(bootstrap).toBeDefined();
    expect(bootstrap?.type).toBe('chunk');
    expect(html).toBeDefined();
    const source = String(html?.source);
    // Hashed bootstrap script tag is injected.
    expect(source).toMatch(/<script[^>]+vite-pretext-bootstrap-[\w-]+\.js/);
    // Inline config tag is injected too.
    expect(source).toContain('__VITE_PRETEXT_CONFIG__');
  });

  it('emits a bootstrap chunk when the marker appears in a TS source file', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body></html>`,
      'src/main.ts': `
        const p = document.createElement('p');
        p.setAttribute('data-pretext', '');
        p.textContent = 'mounted via JS';
        document.body.appendChild(p);
      `,
    });

    const out = await runBuild();
    const bootstrap = findBootstrapChunk(out);
    expect(bootstrap).toBeDefined();
    const html = findHtml(out);
    expect(String(html?.source)).toMatch(/vite-pretext-bootstrap-[\w-]+\.js/);
  });

  it('emits NOTHING when the marker is absent from both HTML and source', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <p>Just a paragraph, no marker.</p>
  <script type="module" src="/src/main.ts"></script>
</body></html>`,
      'src/main.ts': `console.log('boring')`,
    });

    const out = await runBuild();
    expect(findBootstrapChunk(out)).toBeUndefined();
    const html = findHtml(out);
    expect(String(html?.source)).not.toContain('vite-pretext-bootstrap');
    expect(String(html?.source)).not.toContain('__VITE_PRETEXT_CONFIG__');
  });

  it('honours a custom `include` pattern (e.g. .mjs)', async () => {
    // .mjs is transformed by Vite natively but is NOT matched by the default
    // include patterns ([/\.[jt]sx?$/, /\.vue$/, /\.svelte$/, /\.html$/]),
    // so it's a reliable way to prove the include filter is doing work.
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body></html>`,
      'src/has-marker.mjs': `export default '<p data-pretext>marker in mjs</p>';`,
      'src/main.ts': `import html from './has-marker.mjs'; console.log(html);`,
    });

    // First: default include should miss the marker entirely.
    const defaultOut = await runBuild([vitePretext()]);
    expect(findBootstrapChunk(defaultOut)).toBeUndefined();

    // Set up a fresh fixture with the same files for the positive run, since
    // the previous build already consumed it.
    await fixture.cleanup();
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body></html>`,
      'src/has-marker.mjs': `export default '<p data-pretext>marker in mjs</p>';`,
      'src/main.ts': `import html from './has-marker.mjs'; console.log(html);`,
    });

    // Now: extend include to .mjs and the marker should be picked up.
    const customOut = await runBuild([
      vitePretext({ include: [/\.mjs$/, /\.[jt]sx?$/, /\.html$/] }),
    ]);
    expect(findBootstrapChunk(customOut)).toBeDefined();
  });

  it('hashes the bootstrap chunk filename in production output', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <p data-pretext>x</p>
  <script type="module" src="/src/main.ts"></script>
</body></html>`,
      'src/main.ts': `export {};`,
    });

    const out = await runBuild();
    const bootstrap = findBootstrapChunk(out);
    expect(bootstrap?.fileName).toMatch(/vite-pretext-bootstrap-[\w-]{6,}\.js$/);
  });
});
