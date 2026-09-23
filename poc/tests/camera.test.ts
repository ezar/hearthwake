import { describe, expect, it } from 'vitest';
import { CENTRE_LABEL, pickAt, track, type Detection } from '../src/camera';

const det = (label: string, xmin: number, ymin: number, xmax: number, ymax: number): Detection => ({
  label,
  score: 0.9,
  box: { xmin, ymin, xmax, ymax },
});

describe('pickAt', () => {
  it('picks the smallest box containing the point', () => {
    const table = det('dining table', 0, 0.4, 1, 1);
    const cup = det('cup', 0.4, 0.5, 0.5, 0.6);
    expect(pickAt([table, cup], 0.45, 0.55)).toBe(cup);
    expect(pickAt([table, cup], 0.8, 0.8)).toBe(table);
    expect(pickAt([table, cup], 0.5, 0.1)).toBeNull();
  });
});

describe('track', () => {
  it('follows the nearest box with the same label', () => {
    const sel = det('cup', 0.4, 0.4, 0.5, 0.5);
    const moved = det('cup', 0.45, 0.42, 0.55, 0.52);
    const far = det('cup', 0.9, 0.9, 1, 1);
    expect(track(sel, [far, moved, det('bottle', 0.4, 0.4, 0.5, 0.5)])).toBe(moved);
  });

  it('keeps the last known box when the match moved too far or vanished', () => {
    const sel = det('cup', 0.1, 0.1, 0.2, 0.2);
    expect(track(sel, [det('cup', 0.8, 0.8, 0.9, 0.9)])).toBe(sel);
    expect(track(sel, [])).toBe(sel);
  });

  it('never moves the centre selection', () => {
    const centre = det(CENTRE_LABEL, 0.25, 0.2, 0.75, 0.8);
    expect(track(centre, [det(CENTRE_LABEL, 0.3, 0.2, 0.8, 0.8)])).toBe(centre);
  });
});
