# Changelog

All notable changes to this project are documented here. From v0.0.5 onward
this file is maintained automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/). Entries below
v0.0.5 were backfilled from the git history.

## [0.0.4](https://github.com/BALOTIAS/vite-pretext/releases/tag/v0.0.4)

### 🚀 Features

- Per-element configuration, output modes (`height`/`width`/`lines`/`none`),
  and the runtime measurement API (`window.__vitePretext`, `pretext:measured`
  event, inline CSS variables).
- Configurable smart-marker tag sets (`tags.textLeaf` / `tags.block`),
  API-tailored layout-warning hints, and `// @vite-pretext-ignore` escape
  hatches.

## [0.0.3](https://github.com/BALOTIAS/vite-pretext/releases/tag/v0.0.3)

### 🧰 Maintenance

- Release config and npm publish pipeline.
- README updates to surface the live demo.

## [0.0.2](https://github.com/BALOTIAS/vite-pretext/releases/tag/v0.0.2)

### 🚀 Features

- GitHub Pages demo deployment, respecting the Vite base URL.

### 🧰 Maintenance

- License link and status badges.

## [0.0.1](https://github.com/BALOTIAS/vite-pretext/releases/tag/v0.0.1)

- Initial release: zero-config Vite plugin that delegates text measurement to
  a Web Worker via `@chenglou/pretext` to eliminate text-based CLS.
