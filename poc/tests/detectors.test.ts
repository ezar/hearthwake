import { describe, expect, it } from 'vitest';
import { DETECTORS, toNormalized } from '../src/detectors';

describe('toNormalized', () => {
  it('converts MediaPipe pixel boxes to 0..1 and keeps the top category', () => {
    const out = toNormalized(
      [
        {
          categories: [
            { categoryName: 'cup', score: 0.8 },
            { categoryName: 'bowl', score: 0.3 },
          ],
          boundingBox: { originX: 180, originY: 320, width: 72, height: 128 },
        },
      ],
      720,
      1280,
    );
    expect(out).toEqual([
      { label: 'cup', score: 0.8, box: { xmin: 0.25, ymin: 0.25, xmax: 0.35, ymax: 0.35 } },
    ]);
  });

  it('clamps boxes that spill past the frame', () => {
    const [d] = toNormalized(
      [
        {
          categories: [{ categoryName: 'couch', score: 0.7 }],
          boundingBox: { originX: -20, originY: 600, width: 800, height: 900 },
        },
      ],
      720,
      1280,
    );
    expect(d?.box).toEqual({ xmin: 0, ymin: 600 / 1280, xmax: 1, ymax: 1 });
  });

  it('drops detections without a box or category, and frames without size', () => {
    expect(
      toNormalized(
        [{ categories: [], boundingBox: { originX: 0, originY: 0, width: 1, height: 1 } }],
        10,
        10,
      ),
    ).toEqual([]);
    expect(toNormalized([{ categories: [{ categoryName: 'tv', score: 0.9 }] }], 10, 10)).toEqual([]);
    expect(
      toNormalized(
        [
          {
            categories: [{ categoryName: 'tv', score: 0.9 }],
            boundingBox: { originX: 0, originY: 0, width: 1, height: 1 },
          },
        ],
        0,
        0,
      ),
    ).toEqual([]);
  });
});

describe('DETECTORS', () => {
  it('only the YOLOS WebGPU option needs WebGPU', () => {
    expect(
      Object.entries(DETECTORS)
        .filter(([, d]) => d.needsWebGpu)
        .map(([k]) => k),
    ).toEqual(['yolos-webgpu']);
  });
});
