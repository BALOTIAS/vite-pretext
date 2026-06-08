# Contributing

## Development

```sh
pnpm install
pnpm dev         # tsup --watch + vanilla example dev server
pnpm typecheck   # tsc --noEmit at root + every workspace
pnpm test        # vitest run
pnpm build       # build the plugin (tsup)
```

Run `pnpm typecheck && pnpm test` before opening a PR. CI runs the same gate
on Node 20 and 22.

## Commit messages — Conventional Commits

Releases are automated with
[release-please](https://github.com/googleapis/release-please), which reads
[Conventional Commits](https://www.conventionalcommits.org/) to decide the
next version and to generate `CHANGELOG.md`. Use these prefixes:

| Prefix              | Effect (pre-1.0)        | Changelog section |
|---------------------|-------------------------|-------------------|
| `feat:`             | patch bump¹             | 🚀 Features       |
| `fix:`              | patch bump              | 🐛 Fixes          |
| `perf:`             | patch bump              | ⚡ Performance     |
| `deps:`             | patch bump              | 📦 Dependencies   |
| `refactor:`         | patch bump              | ♻️ Refactoring     |
| `docs:`             | patch bump              | 📚 Documentation  |
| `chore:`            | patch bump              | 🧰 Maintenance    |
| `test:` / `ci:` / `build:` | patch bump       | hidden            |
| `feat!:` / `BREAKING CHANGE:` | minor bump¹  | ⚠️ Breaking        |

¹ This project stays in `0.0.x` / `0.x` for now: `bump-patch-for-minor-pre-major`
and `bump-minor-pre-major` are enabled in `release-please-config.json`, so
features bump the patch and breaking changes bump the minor instead of jumping
to `1.0.0`. Flip those flags in the config when you want normal semver.

Scopes are encouraged, e.g. `fix(orchestrator): …`, `deps(pretext): …`.

## Release flow

1. Merge PRs to `main` with Conventional Commit messages.
2. release-please opens/updates a **release PR** that bumps the version and
   updates `CHANGELOG.md`. Review it like any PR.
3. Merge the release PR. release-please tags the commit and creates the GitHub
   Release; the `publish` job in `.github/workflows/release.yml` then builds,
   re-tests, and publishes to npm with provenance.

You never bump `package.json` or push tags by hand — release-please owns both.

> Note: the release PR itself does not re-run CI (PRs opened by the default
> `GITHUB_TOKEN` don't trigger workflows). That's fine — every commit it
> aggregates already passed CI, and the publish job re-runs the full gate
> before publishing. To get CI on the release PR too, swap the workflow's
> `token` for a PAT.
