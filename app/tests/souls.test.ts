import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from '../src/store/db';
import { loadSettings, saveSettings } from '../src/store/settings';
import {
  forgetSoul,
  getSoul,
  importPocSouls,
  loadSouls,
  POC_SOULS_KEY,
  saveSoul,
  type Soul,
} from '../src/store/souls';

const soul = (id: string, lastTalkedAt: number): Soul => ({
  id,
  label: 'lamp',
  description: 'A lamp.',
  thumbnail: '',
  memory: '',
  history: [],
  createdAt: 1,
  lastTalkedAt,
  name: `Soul ${id}`,
  title: 'T',
  archetype: 'A',
  traits: [],
  style: '',
  catchphrase: '',
  secret: '',
  pitch: 1,
  rate: 1,
  greeting: 'Hi.',
});

beforeEach(async () => {
  await resetDbForTests();
  await loadSouls();
});

describe('souls store', () => {
  it('saves, lists by most recent talk and forgets', async () => {
    await saveSoul(soul('a', 10));
    await saveSoul(soul('b', 20));
    expect((await loadSouls()).map(s => s.id)).toEqual(['b', 'a']);
    await saveSoul({ ...soul('a', 30), name: 'Renamed' });
    expect((await loadSouls()).map(s => s.name)).toEqual(['Renamed', 'Soul b']);
    await forgetSoul('b');
    expect(getSoul('b')).toBeNull();
    expect(await loadSouls()).toHaveLength(1);
  });

  it('imports the spike souls once, without lastTalkedAt, and never twice', async () => {
    // Spike souls were saved without lastTalkedAt.
    const old: Partial<Soul> = soul('poc', 0);
    delete old.lastTalkedAt;
    const storage = {
      getItem: (k: string) =>
        k === POC_SOULS_KEY ? JSON.stringify({ poc: { ...old, createdAt: 5 } }) : null,
    };
    expect(await importPocSouls(storage)).toBe(1);
    expect(await importPocSouls(storage)).toBe(0);
    const [imported] = await loadSouls();
    expect(imported).toMatchObject({ id: 'poc', lastTalkedAt: 5 });
  });

  it('survives damaged spike data', async () => {
    expect(await importPocSouls({ getItem: () => '{nope' })).toBe(0);
  });
});

describe('settings', () => {
  it('starts with defaults and keeps changes', async () => {
    expect(await loadSettings()).toEqual({ onboarded: false, speak: true });
    await saveSettings({ onboarded: true });
    expect(await loadSettings()).toEqual({ onboarded: true, speak: true });
  });
});
