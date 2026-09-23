// Souls persisted in localStorage for this PoC (IndexedDB comes in M1).
const KEY = 'hearthwake.poc.souls';

const readAll = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
};

export const listSouls = () => Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt);
export const getSoul = id => readAll()[id] ?? null;

export function saveSoul(soul) {
  const all = readAll();
  all[soul.id] = soul;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Could not persist soul', e);
  }
}

export function forgetSoul(id) {
  const all = readAll();
  delete all[id];
  localStorage.setItem(KEY, JSON.stringify(all));
}
