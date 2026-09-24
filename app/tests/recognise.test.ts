import { describe, expect, it } from 'vitest';
import { describeGap, welcomeBackPrompt } from '../src/engine/llm';
import { bestMatch, MATCH_AT, MATCH_SAME_LABEL_AT } from '../src/engine/recognise';
import { compactSignature, similarity } from '../src/engine/vision';
import type { Soul } from '../src/store/souls';

const soul = (id: string, label: string, signature?: number[]): Soul => ({
  id,
  label,
  signature,
  description: `A ${label}.`,
  thumbnail: '',
  memory: 'Leo has a cat called Luna.',
  history: [
    { role: 'assistant', content: 'Hello!' },
    { role: 'user', content: 'Luna ran away.' },
  ],
  createdAt: 0,
  lastTalkedAt: 0,
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

// A unit vector at `angle` radians in the plane, so similarity = cos(difference).
const at = (angle: number) => [Math.cos(angle), Math.sin(angle)];

describe('similarity', () => {
  it('is 1 for the same direction, 0 for orthogonal and for mismatched sizes', () => {
    expect(similarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(similarity([1, 0], [0, 1])).toBe(0);
    expect(similarity([1, 0], [1, 0, 0])).toBe(0);
    expect(similarity([], [])).toBe(0);
  });

  it('keeps signatures small without changing them', () => {
    expect(compactSignature([0.123456, -0.98765])).toEqual([0.123, -0.988]);
  });
});

describe('bestMatch', () => {
  const door = soul('door', 'sliding door', at(0));
  const lamp = soul('lamp', 'table lamp', at(Math.PI / 2));

  it('finds the most similar soul above the threshold', () => {
    const match = bestMatch(at(0.1), 'sliding door', [lamp, door]);
    expect(match?.soul.id).toBe('door');
    expect(match!.score).toBeCloseTo(Math.cos(0.1));
  });

  it('asks for more similarity when the classifier disagrees', () => {
    const between = Math.acos((MATCH_AT + MATCH_SAME_LABEL_AT) / 2);
    expect(bestMatch(at(between), 'sliding door', [door])?.soul.id).toBe('door');
    expect(bestMatch(at(between), 'wardrobe', [door])).toBeNull();
  });

  it('ignores souls without a signature and finds nothing when nothing is close', () => {
    expect(bestMatch(at(0), 'lamp', [soul('x', 'lamp')])).toBeNull();
    expect(bestMatch(at(Math.PI), 'sliding door', [door, lamp])).toBeNull();
  });
});

describe('welcome back', () => {
  it('says how long it has been', () => {
    const h = 3_600_000;
    expect(describeGap(10 * 60_000)).toBe('A few minutes have passed');
    expect(describeGap(5 * h)).toBe('A few hours have passed');
    expect(describeGap(26 * h)).toBe('A day has passed');
    expect(describeGap(3 * 24 * h)).toBe('3 days have passed');
    expect(describeGap(21 * 24 * h)).toBe('3 weeks have passed');
    expect(describeGap(120 * 24 * h)).toBe('Months have passed');
  });

  it('gives the model its memories, the last words and the time away', () => {
    const messages = welcomeBackPrompt(soul('door', 'sliding door'), 26 * 3_600_000, true);
    expect(messages[0]!.content).toContain('Leo has a cat called Luna.');
    expect(messages.map(m => m.content)).toContain('Luna ran away.');
    const ask = messages.at(-1)!;
    expect(ask.role).toBe('user');
    expect(ask.content).toContain('A day has passed');
    expect(ask.content).toContain('pointed the camera at you again');
  });
});
