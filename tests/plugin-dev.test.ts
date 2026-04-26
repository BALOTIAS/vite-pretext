// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { vitePretext } from '../src/index.js';
import { setupFixture, type Fixture } from './helpers.js';

let fixture: Fixture | null = null;
let server: ViteDevServer | null = null;
afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
  if (fixture) {
    await fixture.cleanup();
    fixture = null;
  }
});

async function startServer(plugins = [vitePretext()]): Promise<string> {
  if (!fixture) throw new Error('fixture not set up');
  server = await createServer({
    root: fixture.dir,
    configFile: false,
    logLevel: 'silent',
    server: { port: 0, host: '127.0.0.1' },
    plugins,
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind dev server');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('plugin (dev)', () => {
  it('always injects the bootstrap script in dev, even when no marker is present', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <p>Plain HTML, no marker.</p>
  <script type="module" src="/src/main.ts"></script>
</body></html>`,
      'src/main.ts': `console.log('boring')`,
    });

    const url = await startServer();
    const res = await fetch(url + '/');
    const html = await res.text();
    expect(html).toContain('/__vite-pretext-bootstrap.js');
    expect(html).toContain('__VITE_PRETEXT_CONFIG__');
  });

  it('claims the bootstrap virtual URL (resolveId/load hooks fire)', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <p data-pretext>x</p>
  <script type="module" src="/src/main.ts"></script>
</body></html>`,
      'src/main.ts': `export {};`,
    });

    const url = await startServer();
    const res = await fetch(url + '/__vite-pretext-bootstrap.js');
    // 200 if the bare specifier `vite-pretext/orchestrator` resolves in this
    // fixture (only true when the fixture is inside the monorepo). 500 is the
    // expected response in a bare tmp fixture: Vite handled the URL via the
    // plugin's resolveId/load hooks, then failed to resolve the inner import.
    // 404 would mean the plugin didn't claim the URL at all — that's the
    // regression we're guarding against.
    expect(res.status).not.toBe(404);
  });

  it('exposes the user-provided fallbacks in the inline config tag', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body>
  <p data-pretext>x</p>
</body></html>`,
    });

    const url = await startServer([
      vitePretext({
        fallbacks: { fontFamily: 'Inter', fontSize: '18px', lineHeight: '1.7' },
      }),
    ]);
    const res = await fetch(url + '/');
    const html = await res.text();
    expect(html).toContain('"fontFamily":"Inter"');
    expect(html).toContain('"fontSize":"18px"');
    expect(html).toContain('"lineHeight":"1.7"');
  });

  it('includes applyStyles=true in the inline config by default', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><p data-pretext>x</p></body></html>`,
    });
    const url = await startServer();
    const html = await (await fetch(url + '/')).text();
    expect(html).toContain('"applyStyles":true');
  });

  it('respects applyStyles: false in the plugin config', async () => {
    fixture = await setupFixture({
      'index.html': `<!doctype html>
<html><body><p data-pretext>x</p></body></html>`,
    });
    const url = await startServer([vitePretext({ applyStyles: false })]);
    const html = await (await fetch(url + '/')).text();
    expect(html).toContain('"applyStyles":false');
  });
});
