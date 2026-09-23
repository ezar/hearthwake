# Hearthwake PoC (M0)

Single-page test harness for the M0 spike: device probe, model loading, live detection, waking a thing, talking to it, and a copyable JSON report. The spec is [`../docs/m0-spike.md`](../docs/m0-spike.md); the manual test protocol is its section 13.

```
npm ci
npm run dev       # http://localhost:5173/hearthwake/poc/
npm test
npm run build
```

Camera and microphone need HTTPS (or localhost). To test on a phone, use the GitHub Pages deploy.

`reference/` is the original plain-JS prototype, kept as a guide. It is not built or checked.
