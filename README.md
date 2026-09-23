# Hearthwake

Household objects wake up and talk, with every AI model running locally in the browser.

Current milestone: **M1 app**. M0, the feasibility spike, showed that an iPhone can wake a household object and talk to it with the AI running in the browser. Its conclusions are in [ADR 0018](docs/decisions/0018-close-m0.md), and the spike's spec in [`docs/m0-spike.md`](docs/m0-spike.md).

- App: [`app/`](app/) (Vite + React + TypeScript), live at `https://ezar.github.io/hearthwake/`. Run `npm ci && npm run dev` inside it; add `?mock` to the URL to try it without WebGPU.
- Spike code: [`poc/`](poc/) (Vite + TypeScript), kept as the M0 test harness. Run `npm ci && npm run dev` inside it.
- Live spike: `https://ezar.github.io/hearthwake/poc/`.
- Results: [`docs/models.md`](docs/models.md). Decisions: [`docs/decisions/`](docs/decisions/).
