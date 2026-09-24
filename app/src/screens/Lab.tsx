// The Lab: small experiments with the same on-device AI, beyond waking things up (ADR 0024).
import { useT } from '../i18n';
import { goBack } from '../router';
import { Back, Gauge, Notebook, Scan } from '../ui/icons';
import { Link } from '../ui/Link';
import { useTitle } from '../ui/useTitle';

export function Lab() {
  const t = useT();
  useTitle(t('Lab'));
  const items = [
    {
      to: { name: 'bench' } as const,
      icon: <Gauge />,
      title: t('How fast is this device?'),
      detail: t('A benchmark of the model and vision on this device, to share and compare.'),
    },
    {
      to: { name: 'diary' } as const,
      icon: <Notebook />,
      title: t('Private diary'),
      detail: t('Write or dictate; the model reflects on your week. What you write stays on this device.'),
    },
    {
      to: { name: 'reader' } as const,
      icon: <Scan />,
      title: t('Label reader'),
      detail: t('Photograph a label or a menu and ask about it: ingredients, allergens, a translation.'),
    },
  ];
  return (
    <main className="screen">
      <header className="bar">
        <button
          className="icon-btn icon-btn--bare"
          aria-label={t('Back')}
          onClick={() => goBack({ name: 'home' })}
        >
          <Back />
        </button>
      </header>
      <section className="stack" style={{ gap: 6 }}>
        <h1>{t('Lab')}</h1>
        <p className="lede">{t('More experiments with the same AI, running on this device.')}</p>
      </section>
      <ul className="soul-list">
        {items.map(item => (
          <li key={item.to.name}>
            <Link to={item.to} className="soul-row lab-row">
              <span className="lab-row__icon">{item.icon}</span>
              <span className="soul-row__text">
                <span className="soul-row__name">{item.title}</span>
                <span className="lab-row__detail">{item.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
