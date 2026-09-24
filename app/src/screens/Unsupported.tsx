// Shown when this browser cannot run the LLM: WebGPU is required (ADR 0003).
import { Flame } from '../ui/icons';
import { useT } from '../i18n';

export function Unsupported() {
  const t = useT();
  return (
    <main className="screen welcome">
      <span className="welcome__mark">
        <Flame size={56} />
      </span>
      <section className="stack" style={{ gap: 12 }}>
        <h1 className="welcome__title">{t("This browser can't wake things up yet.")}</h1>
        <p className="lede">
          {t(
            'Hearthwake runs its AI on your device, and that needs WebGPU, which this browser does not offer.',
          )}
        </p>
      </section>
      <ul className="checklist card">
        <li>{t('On iPhone or iPad: Safari or Chrome, on iOS 26 or later.')}</li>
        <li>{t('On a computer: Chrome or Edge.')}</li>
        <li>{t('On Android: Chrome, on a recent phone.')}</li>
      </ul>
      <div className="spacer" />
      <p className="lede" style={{ fontSize: 13 }}>
        {t('Curious what works here? The test harness checks each part on its own.')}{' '}
        <a href={`${import.meta.env.BASE_URL}poc/`}>{t('Open the test harness')}</a>
      </p>
    </main>
  );
}
