# Hearthwake

Household objects wake up and talk, with every AI model running locally in the browser.

## Current milestone: M0 feasibility spike

Build only what `docs/m0-spike.md` describes. Read it before changing anything in `poc/`.

- `poc/` is the spike: Vite + TypeScript (strict), vanilla DOM. `poc/reference/` is the original plain-JS prototype, kept as a guide only; it is not built, linted or tested.
- `docs/models.md` collects measured results per device. `docs/decisions/` holds short ADRs; record every decision there.
- Code, comments, identifiers, commits and docs in English. UI strings in Spanish.
- No React, PWA, IndexedDB, WebXR or game logic until M1.

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
