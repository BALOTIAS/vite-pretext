import type { Plugin } from 'vite';
import { version as viteVersion } from 'vite';
import type { VitePretextOptions, VitePretextConfig } from './types.js';

const DEFAULT_INCLUDE: RegExp[] = [/\.[jt]sx?$/, /\.vue$/, /\.svelte$/, /\.html$/];
const DEFAULT_FALLBACKS = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '16px',
  lineHeight: '1.5',
};

const ATTR_MARKER = 'data-pretext';
const BOOTSTRAP_PATH = '/__vite-pretext-bootstrap.js';
const BOOTSTRAP_RESOLVED = '\0vite-pretext-bootstrap';
const BOOTSTRAP_SOURCE = `import 'vite-pretext/orchestrator';\n`;
const BOOTSTRAP_CHUNK_NAME = 'vite-pretext-bootstrap';

// Layout-forcing DOM reads pretext is designed to replace. Each match emits
// a build warning (with file/line/column) unless the user passes warn: false.
// Heuristic — regex scan can flag matches inside comments or strings.
const LAYOUT_API_PATTERNS: { regex: RegExp; api: string }[] = [
  { regex: /\.offsetHeight\b/g, api: 'offsetHeight' },
  { regex: /\.offsetWidth\b/g, api: 'offsetWidth' },
  { regex: /\.offsetTop\b/g, api: 'offsetTop' },
  { regex: /\.offsetLeft\b/g, api: 'offsetLeft' },
  { regex: /\.clientHeight\b/g, api: 'clientHeight' },
  { regex: /\.clientWidth\b/g, api: 'clientWidth' },
  { regex: /\.getBoundingClientRect\s*\(/g, api: 'getBoundingClientRect()' },
];

export function vitePretext(options: VitePretextOptions = {}): Plugin {
  const include = (options.include ?? DEFAULT_INCLUDE).map((p) =>
    typeof p === 'string' ? new RegExp(p) : p,
  );
  const config: VitePretextConfig = {
    fallbacks: { ...DEFAULT_FALLBACKS, ...options.fallbacks },
    applyStyles: options.applyStyles ?? true,
  };
  const warn = options.warn ?? true;

  let usesPretext = false;
  let isBuild = false;
  // Captured from `configResolved`. Always has a trailing slash; defaults to
  // '/' so the script src works on root deployments.
  let baseUrl = '/';

  return {
    name: 'vite-pretext',

    config(_userConfig, env) {
      isBuild = env.command === 'build';
      // Reset per-build state so stale flags from a previous run don't leak.
      if (isBuild) usesPretext = false;
      // The orchestrator uses `new URL('./worker.js', import.meta.url)` to spawn
      // the worker; pre-bundling via optimizeDeps would inline the file and break
      // that pattern. Excluding keeps it as a real ESM file Vite's worker plugin
      // can recognize.
      return {
        optimizeDeps: { exclude: ['vite-pretext'] },
      };
    },

    configResolved(resolved) {
      baseUrl = resolved.base; // Vite normalises this to end with '/'
      const major = Number.parseInt(viteVersion.split('.')[0] ?? '0', 10);
      if (major > 0 && major < 8) {
        resolved.logger.warn(
          `[vite-pretext] expected Vite >= 8, got ${viteVersion}. v0.1 only supports Vite 8+; upgrade for full functionality.`,
        );
      }
    },

    resolveId(id) {
      if (id === BOOTSTRAP_PATH || id === BOOTSTRAP_RESOLVED) return BOOTSTRAP_RESOLVED;
      return null;
    },

    load(id) {
      if (id === BOOTSTRAP_RESOLVED) return BOOTSTRAP_SOURCE;
      return null;
    },

    transform(code, id) {
      if (!include.some((re) => re.test(id))) return;
      // Skip vendored code: warning users about library internals isn't
      // actionable, and the marker check is irrelevant there too.
      if (id.includes('node_modules')) return;

      if (warn) {
        for (const { regex, api } of LAYOUT_API_PATTERNS) {
          regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(code)) !== null) {
            const before = code.slice(0, match.index);
            const line = before.split('\n').length;
            const lastNl = before.lastIndexOf('\n');
            const column = match.index - (lastNl + 1);
            this.warn({
              message:
                `\`${api}\` forces synchronous layout. Where possible, read the ` +
                `pretext-cached \`el.style.minHeight\` instead. ` +
                `Set \`warn: false\` in the plugin options to silence.`,
              id,
              loc: { file: id, line, column },
            });
          }
        }
      }

      if (!usesPretext && code.includes(ATTR_MARKER)) {
        usesPretext = true;
        // Emit the bootstrap chunk the first time a marker is seen so Rollup
        // bundles the orchestrator (and the worker pulled in via its `new URL`
        // pattern). emitFile is only valid in build hooks; skip in dev where the
        // dev server resolves bare specifiers on the fly.
        if (isBuild) {
          this.emitFile({
            type: 'chunk',
            id: BOOTSTRAP_RESOLVED,
            name: BOOTSTRAP_CHUNK_NAME,
          });
        }
      }
      return;
    },

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!usesPretext && html.includes(ATTR_MARKER)) usesPretext = true;
        // In dev, transforms are lazy — module markers may not have been seen
        // when the HTML is first served. Always inject in dev (the orchestrator
        // is a no-op when no marker elements ever appear). In build, transforms
        // have all completed before transformIndexHtml runs, so the flag is
        // authoritative and we keep the "zero bloat when unused" contract.
        const shouldInject = isBuild ? usesPretext : true;
        if (!shouldInject) return;

        // Respect Vite's `base` config so the script tag works under
        // subpath deployments (e.g. GitHub Pages at /<repo>/).
        let scriptSrc = `${baseUrl}__vite-pretext-bootstrap.js`;
        if (isBuild && ctx.bundle) {
          const chunk = Object.values(ctx.bundle).find(
            (c) => c.type === 'chunk' && c.name === BOOTSTRAP_CHUNK_NAME,
          );
          if (chunk) scriptSrc = `${baseUrl}${chunk.fileName}`;
        }

        const configJson = JSON.stringify(config);
        return {
          html,
          tags: [
            {
              tag: 'script',
              injectTo: 'head',
              children: `window.__VITE_PRETEXT_CONFIG__=${configJson};`,
            },
            {
              tag: 'script',
              injectTo: 'head',
              attrs: { type: 'module', src: scriptSrc },
            },
          ],
        };
      },
    },
  };
}
