// Shown when this browser cannot run the LLM: WebGPU is required (ADR 0003).
import { Flame } from '../ui/icons';

export function Unsupported() {
  return (
    <main className="screen welcome">
      <span className="welcome__mark">
        <Flame size={56} />
      </span>
      <section className="stack" style={{ gap: 12 }}>
        <h1 className="welcome__title">This browser can't wake things up yet.</h1>
        <p className="lede">
          Hearthwake runs its AI on your device, and that needs WebGPU, which this browser does not offer.
        </p>
      </section>
      <ul className="checklist card">
        <li>On iPhone or iPad: Safari or Chrome, on iOS 26 or later.</li>
        <li>On a computer: Chrome or Edge.</li>
        <li>On Android: Chrome, on a recent phone.</li>
      </ul>
      <div className="spacer" />
      <p className="lede" style={{ fontSize: 13 }}>
        Curious what works here? The <a href={`${import.meta.env.BASE_URL}poc/`}>test harness</a> checks each
        part on its own.
      </p>
    </main>
  );
}
