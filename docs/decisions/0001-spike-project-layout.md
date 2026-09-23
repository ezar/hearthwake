# 0001. Spike project layout and deploy

Status: accepted, M0.

## Context

The spec asks for Vite + TypeScript under `poc/`, docs under `docs/`, and a GitHub Pages deploy at `/hearthwake/poc/`. The repository had no code yet. A plain-JS prototype of the same spike already existed.

## Decision

- `poc/` is a self-contained npm package (its own `package.json` and lockfile). The repository root holds only docs and CI.
- The prototype lives in `poc/reference/` for comparison. It is excluded from lint, format and typecheck, and Vite does not build it.
- CI builds `poc/` into `_site/poc/` and adds a root `index.html` that redirects to `poc/`, so the Pages URL is `https://<user>.github.io/hearthwake/poc/` and Vite `base` is `/hearthwake/poc/`.
- Pages must be set to deploy from GitHub Actions (Settings, Pages, Source).

## Consequences

M1 can replace `poc/` or add an `app/` package next to it without touching the spike.
