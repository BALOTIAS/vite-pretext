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
// a build warning (with file/line/column) unless the user passes warn: false
// or annotates the line with `// @vite-pretext-ignore`. Heuristic — regex
// scan can flag matches inside comments or strings.
//
// `replacement` names the cached pretext API the user should reach for
// instead. Height-axis reads (offset/client/scroll-Height) replace cleanly
// with `getMeasurement(el)?.height`; width-axis reads with
// `getMeasurement(el)?.naturalWidth`; rectangle reads with the whole
// `getMeasurement(el)` snapshot. Position reads (offsetTop/Left) have no
// pretext equivalent — they get a generic rAF batching suggestion.
const HEIGHT_HINT =
  '`getMeasurement(el)?.height` (cached at `el.style.minHeight` and the `--pretext-height` CSS var)';
const WIDTH_HINT =
  '`getMeasurement(el)?.naturalWidth` (also exposed as the `--pretext-natural-width` CSS var)';
const RECT_HINT = '`getMeasurement(el)` for cached width and height';
const NO_PRETEXT_HINT =
  'batching the read with `requestAnimationFrame` so layout is paid once per frame';

const LAYOUT_API_PATTERNS: { regex: RegExp; api: string; replacement: string }[] = [
  { regex: /\.offsetHeight\b/g, api: 'offsetHeight', replacement: HEIGHT_HINT },
  { regex: /\.clientHeight\b/g, api: 'clientHeight', replacement: HEIGHT_HINT },
  { regex: /\.scrollHeight\b/g, api: 'scrollHeight', replacement: HEIGHT_HINT },
  { regex: /\.offsetWidth\b/g, api: 'offsetWidth', replacement: WIDTH_HINT },
  { regex: /\.clientWidth\b/g, api: 'clientWidth', replacement: WIDTH_HINT },
  { regex: /\.scrollWidth\b/g, api: 'scrollWidth', replacement: WIDTH_HINT },
  { regex: /\.getBoundingClientRect\s*\(/g, api: 'getBoundingClientRect()', replacement: RECT_HINT },
  { regex: /\.getClientRects\s*\(/g, api: 'getClientRects()', replacement: RECT_HINT },
  { regex: /\.offsetTop\b/g, api: 'offsetTop', replacement: NO_PRETEXT_HINT },
  { regex: /\.offsetLeft\b/g, api: 'offsetLeft', replacement: NO_PRETEXT_HINT },
];

const IGNORE_MARKER = '@vite-pretext-ignore';

/**
 * True when the match site is annotated with `// @vite-pretext-ignore` on
 * the matched line itself or on the immediately preceding line. We scan
 * raw substrings (no JS parsing) — same heuristic posture as the warning
 * scan; cheap and correct for typical comment placements.
 */
function isIgnored(code: string, matchIndex: number): boolean {
  const lineStart = code.lastIndexOf('\n', matchIndex - 1) + 1;
  const lineEndIdx = code.indexOf('\n', matchIndex);
  const lineEnd = lineEndIdx === -1 ? code.length : lineEndIdx;
  const currentLine = code.slice(lineStart, lineEnd);
  if (currentLine.includes(IGNORE_MARKER)) return true;

  if (lineStart === 0) return false;
  const prevLineEnd = lineStart - 1;
  const prevLineStart = code.lastIndexOf('\n', prevLineEnd - 1) + 1;
  const previousLine = code.slice(prevLineStart, prevLineEnd);
  return previousLine.includes(IGNORE_MARKER);
}

export function vitePretext(options: VitePretextOptions = {}): Plugin {
  const include = (options.include ?? DEFAULT_INCLUDE).map((p) =>
    typeof p === 'string' ? new RegExp(p) : p,
  );
  const config: VitePretextConfig = {
    fallbacks: { ...DEFAULT_FALLBACKS, ...options.fallbacks },
    applyStyles: options.applyStyles ?? true,
    tags: {
      textLeaf: options.tags?.textLeaf ?? [],
      block: options.tags?.block ?? [],
    },
  };
  const warn = options.warn ?? true;

  let usesPretext = false;
  let isBuild = false;
  // Captured from `configResolved`. Always has a trailing slash; defaults to
  // '/' so the script src works on root deployments.
  let baseUrl = '/';

  return {
    name: 'vite-pretext',
    // Run before esbuild's TS transformer so the warning scan sees raw
    // source — important for the `// @vite-pretext-ignore` line comment,
    // which esbuild would otherwise strip before we see the code.
    enforce: 'pre',

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
        for (const { regex, api, replacement } of LAYOUT_API_PATTERNS) {
          regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(code)) !== null) {
            if (isIgnored(code, match.index)) continue;
            const before = code.slice(0, match.index);
            const line = before.split('\n').length;
            const lastNl = before.lastIndexOf('\n');
            const column = match.index - (lastNl + 1);
            this.warn({
              message:
                `\`${api}\` forces synchronous layout. Use ${replacement} instead. ` +
                `Suppress per-site with \`// ${IGNORE_MARKER}\`, or globally with ` +
                `\`warn: false\` in the plugin options.`,
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
