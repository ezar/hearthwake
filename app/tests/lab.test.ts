import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { aboutTextPrompt, reflectPrompt } from '../src/engine/llm';
import { cleanOcr } from '../src/engine/ocr';
import { deviceName, parseStats } from '../src/screens/Bench';
import { resetDbForTests } from '../src/store/db';
import { addEntry, deleteEntry, loadDiary } from '../src/store/diary';

describe('benchmark', () => {
  it("reads WebLLM's speed report", () => {
    expect(parseStats('prefill: 120.5 tok/s, decode: 28.3 tok/s')).toEqual({ prefill: 120.5, decode: 28.3 });
    expect(parseStats('')).toEqual({ prefill: null, decode: null });
  });

  it('names the device and browser', () => {
    const iphoneChrome =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 27_2_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/154.0 Mobile/15E148 Safari/604.1';
    const iphoneSafari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1';
    const windowsEdge =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0';
    expect(deviceName(iphoneChrome)).toBe('iPhone · Chrome');
    expect(deviceName(iphoneSafari)).toBe('iPhone · Safari');
    expect(deviceName(windowsEdge)).toBe('Windows · Edge');
  });
});

describe('label reader', () => {
  it('joins hyphenated words and drops lines with no words', () => {
    expect(cleanOcr('INGRE-\ndients:  wheat   flour\n~ | .\nsugar')).toBe('INGREdients: wheat flour\nsugar');
  });

  it('asks about the text, warns about OCR mistakes and caps its length', () => {
    const m = aboutTextPrompt('x'.repeat(3000), 'Is it vegan?');
    expect(m[0]!.content).toContain('may have mistakes');
    expect(m[1]!.content).toContain('Question: Is it vegan?');
    expect(m[1]!.content.length).toBeLessThan(1600);
  });
});

describe('diary', () => {
  beforeEach(async () => {
    await resetDbForTests();
    await loadDiary();
  });

  it('keeps entries in order and deletes them', async () => {
    const a = await addEntry(' Walked the dog. ', 1);
    await addEntry('Rainy day.', 2);
    expect((await loadDiary()).map(e => e.text)).toEqual(['Walked the dog.', 'Rainy day.']);
    await deleteEntry(a.id);
    expect((await loadDiary()).map(e => e.text)).toEqual(['Rainy day.']);
  });

  it('reflects on the last entries with how long ago they were written', () => {
    const now = 10 * 86_400_000;
    const m = reflectPrompt(
      [
        { at: now - 3 * 86_400_000, text: 'Walked the dog.' },
        { at: now, text: 'Rainy day.' },
      ],
      now,
    );
    expect(m[0]!.content).toContain('never judge');
    expect(m[1]!.content).toContain('- 3 days ago: Walked the dog.');
    expect(m[1]!.content).toContain('- today: Rainy day.');
  });
});
