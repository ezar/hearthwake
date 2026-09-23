import { describe, expect, it } from 'vitest';
import { colourName, describeThing, dominantColours } from '../src/engine/colours';

describe('colourName', () => {
  it.each([
    [[250, 250, 245], 'white'],
    [[10, 10, 12], 'black'],
    [[128, 128, 130], 'grey'],
    [[200, 30, 30], 'red'],
    [[240, 140, 20], 'orange'],
    [[230, 210, 40], 'yellow'],
    [[40, 160, 60], 'green'],
    [[30, 80, 200], 'blue'],
    [[120, 40, 170], 'purple'],
    [[240, 150, 200], 'pink'],
    [[110, 70, 30], 'brown'],
    [[230, 215, 185], 'beige'],
  ])('names %j as %s', (rgb, name) => {
    const [r, g, b] = rgb as [number, number, number];
    expect(colourName(r, g, b)).toBe(name);
  });
});

describe('dominantColours', () => {
  const pixels = (...runs: [number[], number][]) =>
    runs.flatMap(([rgb, n]) => Array.from({ length: n }, () => [...rgb, 255]).flat());

  it('returns up to two colours that each cover enough of the image', () => {
    expect(dominantColours(pixels([[250, 250, 250], 70], [[30, 80, 200], 30]), 1)).toEqual(['white', 'blue']);
    expect(dominantColours(pixels([[250, 250, 250], 90], [[30, 80, 200], 10]), 1)).toEqual(['white']);
  });

  it('falls back to the most common colour and skips transparent pixels', () => {
    const mixed = pixels([[200, 30, 30], 20], [[40, 160, 60], 19], [[30, 80, 200], 18], [[230, 210, 40], 17]);
    expect(dominantColours(mixed, 1, 0.3)).toEqual(['red']);
    expect(dominantColours([0, 0, 0, 0], 1)).toEqual([]);
  });
});

describe('describeThing', () => {
  it('builds a short sentence with the right article', () => {
    expect(describeThing('radiator', ['white'])).toBe('A white radiator.');
    expect(describeThing('cat', ['orange', 'black'])).toBe('An orange and black cat.');
    expect(describeThing('umbrella', [])).toBe('An umbrella.');
  });
});
