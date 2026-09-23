// Each screen names itself, for the tab, the app switcher and screen readers.
import { useEffect } from 'react';

export function useTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Hearthwake` : 'Hearthwake';
  }, [title]);
}
