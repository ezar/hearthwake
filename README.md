# Hearthwake

Household objects wake up and talk, with every AI model running locally in the browser.

Current milestone: **M1 app**. M0, the feasibility spike, showed that an iPhone can wake a household object and talk to it with the AI running in the browser. Its conclusions are in [ADR 0018](docs/decisions/0018-close-m0.md), and the spike's spec in [`docs/m0-spike.md`](docs/m0-spike.md).

<p>
  <img src="docs/screenshots/hearth.png" width="180" alt="The hearth: the souls that have woken up">
  <img src="docs/screenshots/wake.png" width="180" alt="Waking a sliding door through the camera">
  <img src="docs/screenshots/waking.png" width="180" alt="The soul being written">
  <img src="docs/screenshots/talk.png" width="180" alt="Talking with Flibber">
</p>

Screenshots use the mock engine (`?mock`). On a real device the replies come from the on-device model.

- App: [`app/`](app/) (Vite + React + TypeScript), live at `https://ezar.github.io/hearthwake/`. Run `npm ci && npm run dev` inside it; add `?mock` to the URL to try it without WebGPU.
- Spike code: [`poc/`](poc/) (Vite + TypeScript), kept as the M0 test harness. Run `npm ci && npm run dev` inside it.
- Live spike: `https://ezar.github.io/hearthwake/poc/`.
- Results: [`docs/models.md`](docs/models.md). Decisions: [`docs/decisions/`](docs/decisions/).
