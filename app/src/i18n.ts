// Interface language. English text is the key; Spanish comes from the dictionary in i18n-es.ts, and a missing
// entry falls back to English. `{name}` placeholders are filled from `vars` (ADR 0023).
import { useSyncExternalStore } from 'react';
import { ES } from './i18n-es';

export type Lang = 'en' | 'es';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

export function defaultLang(languages: readonly string[] = globalThis.navigator?.languages ?? []): Lang {
  return languages[0]?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let lang: Lang = 'en';
const listeners = new Set<() => void>();

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const l of listeners) l();
}

export const currentLang = () => lang;

export function translate(text: string, vars: Record<string, string | number> = {}, to: Lang = lang): string {
  const template = to === 'es' ? (ES[text] ?? text) : text;
  return template.replace(/\{(\w+)\}/g, (_: string, k: string) => String(vars[k] ?? `{${k}}`));
}

export const t = (text: string, vars?: Record<string, string | number>) => translate(text, vars);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Re-renders a screen when the language changes; returns `t`.
export function useT() {
  useSyncExternalStore(subscribe, currentLang);
  return t;
}

// Speech: the recogniser and the voices use a regional tag.
export const speechLang = (l: Lang = lang) => (l === 'es' ? 'es-ES' : 'en-US');

// The language the souls speak, for prompts.
export const languageName = (l: Lang = lang) => (l === 'es' ? 'Spanish (from Spain)' : 'English');
