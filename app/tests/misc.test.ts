import { describe, expect, it } from 'vitest';
import { centreSquare, coveredSquare } from '../src/engine/camera';
import { median } from '../src/engine/metrics';
import { shortLabel, sightFrom } from '../src/engine/vision';
import { memoryFacts } from '../src/screens/SoulPage';
import { shortWhen } from '../src/ui/time';

describe('centreSquare', () => {
  it('centres a square on the shorter side', () => {
    expect(centreSquare(720, 1280, 0.5)).toEqual({ x: 180, y: 460, side: 360 });
    expect(centreSquare(1280, 720, 1)).toEqual({ x: 280, y: 0, side: 720 });
  });
});

describe('coveredSquare', () => {
  it('maps a viewfinder square back to video pixels under object-fit: cover', () => {
    // A 720x1280 video in a 390x844 box is scaled by 844/1280 and overflows 42 px each side.
    const scale = 844 / 1280;
    const sq = coveredSquare(
      { width: 720, height: 1280 },
      { width: 390, height: 844 },
      { x: 55, y: 200, side: 280 },
    );
    expect(sq.side).toBe(Math.round(280 / scale));
    expect(sq.x).toBe(Math.round((55 + (720 * scale - 390) / 2) / scale));
    expect(sq.y).toBe(Math.round(200 / scale));
  });

  it('never leaves the video', () => {
    const sq = coveredSquare(
      { width: 640, height: 480 },
      { width: 640, height: 480 },
      { x: -50, y: 400, side: 200 },
    );
    expect(sq).toEqual({ x: 0, y: 280, side: 200 });
  });
});

describe('sight', () => {
  const orange = Array.from({ length: 64 }, (_, i) => [240, 138, 75, 255][i % 4]!);

  it('names a confident guess with its colours', () => {
    expect(sightFrom([{ label: 'sliding door', score: 0.49 }], orange)).toMatchObject({
      label: 'sliding door',
      description: 'An orange sliding door.',
    });
  });

  it('calls a weak guess a thing', () => {
    expect(sightFrom([{ label: 'shoji', score: 0.07 }], orange)).toMatchObject({
      label: null,
      description: 'An orange thing.',
    });
  });

  it('shortens ImageNet names', () => {
    expect(shortLabel('teddy, teddy bear')).toBe('teddy');
  });
});

describe('shortWhen', () => {
  const now = new Date(2026, 8, 24, 12, 0).getTime();
  it('says just now, minutes, yesterday, a weekday or a date', () => {
    expect(shortWhen(now - 10_000, now)).toBe('just now');
    expect(shortWhen(now - 5 * 60_000, now)).toBe('5 min');
    expect(shortWhen(new Date(2026, 8, 23, 20, 0).getTime(), now)).toBe('Yesterday');
    expect(shortWhen(new Date(2026, 8, 21, 9, 0).getTime(), now)).toBe('Mon');
    expect(shortWhen(new Date(2026, 7, 2, 9, 0).getTime(), now)).toBe('Aug 2');
  });
});

describe('memoryFacts', () => {
  it('splits the summary into sentences', () => {
    expect(memoryFacts('Leo has a dog. It is called Luna!  ')).toEqual([
      'Leo has a dog.',
      'It is called Luna!',
    ]);
    expect(memoryFacts('')).toEqual([]);
  });
});

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
