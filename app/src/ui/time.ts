// "just now", "5 min", "Yesterday", "Mon", "Sep 21": short relative times for the soul list.
export function shortWhen(at: number, now = Date.now()): string {
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const then = new Date(at);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (at >= startOfToday) return then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const days = Math.ceil((startOfToday - at) / 86400000);
  if (days <= 1) return 'Yesterday';
  if (days < 7) return then.toLocaleDateString('en-US', { weekday: 'short' });
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
