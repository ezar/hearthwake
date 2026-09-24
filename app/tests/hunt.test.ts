import { describe, expect, it } from 'vitest';
import { riddle, type LlmBackend } from '../src/engine/llm';
import { canHunt, pickRound } from '../src/screens/Hunt';
import type { Soul } from '../src/store/souls';

const soul = (id: string, signature?: number[]): Soul => ({
  id,
  name: `Soul ${id}`,
  label: 'sliding door',
  signature,
  description: 'An orange door.',
  thumbnail: '',
  memory: '',
  history: [],
  createdAt: 0,
  lastTalkedAt: 0,
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

describe('pickRound', () => {
  const photo = soul('photo', [1, 0]);
  const words = soul('words');

  it('hides a thing with a photo and lets another give the clue', () => {
    expect(pickRound([words, photo], [])).toEqual({ host: words, target: photo });
  });

  it('prefers things not hidden yet, then starts over', () => {
    const other = soul('other', [0, 1]);
    const first = () => 0;
    expect(pickRound([photo, other, words], ['photo'], first)?.target.id).toBe('other');
    expect(pickRound([photo, other, words], ['photo', 'other'], first)?.target.id).toBe('photo');
  });

  it('needs two things, one of them with a photo', () => {
    expect(canHunt([photo])).toBe(false);
    expect(canHunt([words, soul('w2')])).toBe(false);
    expect(canHunt([words, photo])).toBe(true);
    expect(pickRound([photo], [])).toBeNull();
  });
});

describe('riddle', () => {
  it('never gives the answer away', async () => {
    const llm: LlmBackend = {
      load: async () => undefined,
      stream: async function* () {},
      complete: async () => ({
        text: 'I am a Sliding Door called Soul x. (winks)',
        finishReason: 'stop',
        tokens: 9,
      }),
    };
    expect(await riddle(llm, soul('host'), { ...soul('x'), name: 'Soul x' })).toBe('I am a … called ….');
  });
});
