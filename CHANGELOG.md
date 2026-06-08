# Changelog

All notable changes to this project are documented here. From v0.0.5 onward
this file is maintained automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/). Entries below
v0.0.5 were backfilled from the git history.

## [0.0.5](https://github.com/BALOTIAS/vite-pretext/compare/v0.0.4...v0.0.5) (2026-06-08)


### 🚀 Features

* **demo:** add looping hero driver ([6625ccf](https://github.com/BALOTIAS/vite-pretext/commit/6625ccfad462091725e692cb3799281dc1be3ddd))
* **demo:** add Streamer.clear() for hero loop resets ([4e17d6e](https://github.com/BALOTIAS/vite-pretext/commit/4e17d6e841a4e97e4ff6e600ac999c8a46fa248a))
* **demo:** build playground page (modes, lines, chips, fonts) ([6ac2395](https://github.com/BALOTIAS/vite-pretext/commit/6ac239562c75ebe54ea60ebda1c3a8dfc5c996a0))
* **demo:** rebuild landing markup (hero, poke-it, fps, get-started) ([8141e46](https://github.com/BALOTIAS/vite-pretext/commit/8141e463640889f2c13bdcce3d09048323a00fdd))
* **demo:** set up two-page MPA build (landing + playground) ([6c2c239](https://github.com/BALOTIAS/vite-pretext/commit/6c2c2390526833e3029345f1c8a54e29ef9e9fca))
* **demo:** styles for landing + playground; drop dead bar/showcase rules ([f26d895](https://github.com/BALOTIAS/vite-pretext/commit/f26d895c487117cbcc5cac75f49f07c1696b6d5d))
* **demo:** wire landing page (hero loop, poke-it, fps, copy) ([4654214](https://github.com/BALOTIAS/vite-pretext/commit/4654214d5845823eaea99d25d20c95db3c93e70b))


### 🐛 Fixes

* break CSS feedback-loop oscillation via width-stable resize suppression ([d2c3c0c](https://github.com/BALOTIAS/vite-pretext/commit/d2c3c0c05901d37b7ab9fcbc4b7cab0dc1ef03dd))
* **demo:** cancel pending settle-wait on hero replay ([64a751d](https://github.com/BALOTIAS/vite-pretext/commit/64a751dd096d99cd3cc64a81801819267de2a639))
* **demo:** correct hero-loop timer teardown + replay re-entrancy guard ([96581db](https://github.com/BALOTIAS/vite-pretext/commit/96581db9b4dd551a05791ded3c763ad1fb9e4f38))
* **demo:** landing HTML semantics + modal a11y (main→div, role=dialog, glyph) ([f5698bd](https://github.com/BALOTIAS/vite-pretext/commit/f5698bd3cb45b86289a107b78d5285d74f5bad64))
* **demo:** relative cross-page nav links for sub-path deploys ([6e16300](https://github.com/BALOTIAS/vite-pretext/commit/6e16300ae6976765658d6705863fba34de4cfe97))
* **demo:** visible chrome borders (--rule) + clamp resizable width ([8af41e2](https://github.com/BALOTIAS/vite-pretext/commit/8af41e26d6337280f0304c9e66d89b8d894d66c8))
* **deps:** bump @chenglou/pretext to 0.0.7 ([f9fb3d4](https://github.com/BALOTIAS/vite-pretext/commit/f9fb3d44b142027d13a2a2835a3a6116b527c571))


### ♻️ Refactoring

* **demo:** build playground cards once; aria-live on none-mode readout ([42972d2](https://github.com/BALOTIAS/vite-pretext/commit/42972d2fe66ead2aaf92969ef0ae8c7341b30a1d))
* **demo:** calm hero, click-to-start A/B below install ([77ff545](https://github.com/BALOTIAS/vite-pretext/commit/77ff5456b4752da785ee6a71243444debfc0620d))


### 📚 Documentation

* add showcase rework design spec ([e0f0997](https://github.com/BALOTIAS/vite-pretext/commit/e0f0997dc06fe56dc36410e48d449404528cbd08))
* broaden messaging beyond min-heights/CLS ([5719142](https://github.com/BALOTIAS/vite-pretext/commit/571914204d3745ff58b424d8adc37379baa454e2))

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
