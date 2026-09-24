import { describe, expect, it } from 'vitest';
import { togetherPrompt, type Line } from '../src/engine/llm';
import type { Soul } from '../src/store/souls';
import { wrapLines } from '../src/ui/shareCard';

const soul = (id: string, name: string): Soul => ({
  id,
  name,
  label: 'lamp',
  description: 'A lamp.',
  thumbnail: '',
  memory: '',
  history: [],
  createdAt: 0,
  lastTalkedAt: 0,
  title: `${name} the Great`,
  archetype: 'A',
  traits: ['kind'],
  style: '',
  catchphrase: '',
  secret: '',
  pitch: 1,
  rate: 1,
  greeting: 'Hi.',
});

describe('togetherPrompt', () => {
  const a = soul('a', 'Flibber');
  const b = soul('b', 'Pip');

  it('opens with an instruction for whoever starts', () => {
    const m = togetherPrompt(a, b, 'the weather', []);
    expect(m[0]!.role).toBe('system');
    expect(m[0]!.content).toContain('chatting with Pip, Pip the Great');
    expect(m[1]).toEqual({ role: 'user', content: '(You start. Say something to Pip about the weather.)' });
  });

  it("sees the other thing's lines as user turns and its own as assistant turns", () => {
    const lines: Line[] = [
      { speaker: 'a', text: 'Hello Pip.' },
      { speaker: 'b', text: 'Hello Flibber.' },
    ];
    expect(togetherPrompt(b, a, 'x', lines.slice(0, 1)).slice(1)).toEqual([
      { role: 'user', content: 'Hello Pip.' },
    ]);
    const forA = togetherPrompt(a, b, 'x', lines).slice(1);
    expect(forA.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(forA.at(-1)!.content).toBe('Hello Flibber.');
  });
});

describe('wrapLines', () => {
  const measure = (s: string) => s.length * 10;
  it('wraps words to the width and never splits a word', () => {
    expect(wrapLines('The Sliding Door of Destiny', 120, measure)).toEqual([
      'The Sliding',
      'Door of',
      'Destiny',
    ]);
    expect(wrapLines('Supercalifragilistic', 50, measure)).toEqual(['Supercalifragilistic']);
    expect(wrapLines('  ', 50, measure)).toEqual([]);
  });
});
