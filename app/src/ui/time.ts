// "just now", "5 min", "Yesterday", "Mon", "Sep 21": short relative times for the soul list.
import { currentLang, t } from '../i18n';

export function shortWhen(at: number, now = Date.now()): string {
  const locale = currentLang() === 'es' ? 'es-ES' : 'en-US';
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return t('just now');
  if (minutes < 60) return t('{n} min', { n: minutes });
  const then = new Date(at);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (at >= startOfToday) return then.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const days = Math.ceil((startOfToday - at) / 86400000);
  if (days <= 1) return t('Yesterday');
  if (days < 7) return then.toLocaleDateString(locale, { weekday: 'short' });
  return then.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
