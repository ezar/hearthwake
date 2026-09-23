# Hearthwake

Household objects wake up and talk, with every AI model running locally in the browser.

## Current milestone: M1 app

M0 (the feasibility spike) is closed: see `docs/decisions/0018-close-m0.md` for what it proved and the model set M1 uses.

- `poc/` is the M0 spike: Vite + TypeScript (strict), vanilla DOM, spec in `docs/m0-spike.md`. Keep it building and deployed at `/hearthwake/poc/`; change it only to keep it working. `poc/reference/` is the original plain-JS prototype, kept as a guide only; it is not built, linted or tested.
- `docs/models.md` collects measured results per device. `docs/decisions/` holds short ADRs; record every decision there.
- Code, comments, identifiers, commits and docs in English. UI strings and souls in English too (ADR 0012).

## Commands (run in `poc/`)

```
npm ci
npm run dev            # local server; camera and mic work on localhost
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

CI (`.github/workflows/poc.yml`) runs the same checks and deploys `main` to GitHub Pages at `/hearthwake/poc/`.
