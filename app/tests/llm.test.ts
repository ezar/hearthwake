import { describe, expect, it } from 'vitest';
import {
  clamp,
  compactMemory,
  createSoul,
  describeFailedOutput,
  endAtSentence,
  extractFirstObject,
  needsCompaction,
  normalizeSoul,
  parseJson,
  reply,
  stripStageDirections,
  systemPrompt,
  trimHistory,
  type Completion,
  type LlmBackend,
} from '../src/engine/llm';
import type { ChatMessage, Soul } from '../src/store/souls';

const msg = (role: ChatMessage['role'], content: string): ChatMessage => ({ role, content });
const turns = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => msg(i % 2 ? 'user' : 'assistant', `m${i}`));

const soul = (history: ChatMessage[] = [], memory = ''): Soul => ({
  id: 's1',
  label: 'mug',
  description: 'A red mug.',
  thumbnail: '',
  memory,
  history,
  createdAt: 0,
  lastTalkedAt: 0,
  name: 'Tina',
  title: 'Queen of Breakfast',
  archetype: 'Kind grandmother',
  traits: ['sweet', 'patient', 'warm'],
  style: 'Talks slowly',
  catchphrase: 'Nice and warm!',
  secret: 'Has a tiny crack',
  pitch: 1,
  rate: 1,
  greeting: 'Hello.',
});

function fakeLlm(
  completions: Partial<Completion>[],
  stream: string[] = [],
): LlmBackend & { calls: unknown[] } {
  const calls: unknown[] = [];
  let i = 0;
  return {
    calls,
    load: async () => undefined,
    complete: async request => {
      calls.push(request);
      const c = completions[Math.min(i++, completions.length - 1)] ?? {};
      return { text: '', finishReason: 'stop', tokens: 10, ...c };
    },
    async *stream(request) {
      calls.push(request);
      yield* stream;
    },
  };
}

const SOUL_JSON = JSON.stringify({
  name: 'Flibber',
  title: 'The Sliding Door of Destiny',
  archetype: 'Timekeeper',
  traits: ['Timely', 'whimsical', 'optimistic'],
  style: 'Quick.',
  catchphrase: 'Aha!',
  secret: 'Squeaks on purpose.',
  pitch: 'high',
  rate: 'fast',
  greeting: 'Hello, I am Flibber! I look like a grey sliding door.',
});

describe('parseJson', () => {
  it('parses clean JSON and extracts objects from prose', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('Sure! ```json\n{"a":{"b":2}}\n``` done')).toEqual({ a: { b: 2 } });
  });

  it('ignores braces inside strings', () => {
    expect(extractFirstObject('x {"a":"}{"} y')).toBe('{"a":"}{"}');
  });

  it('fails clearly when there is no usable object', () => {
    expect(() => parseJson('no json here')).toThrow('valid JSON');
  });
});

describe('clamp', () => {
  it('clamps numbers and numeric strings, and falls back on garbage', () => {
    expect(clamp(5, 0, 2, 1)).toBe(2);
    expect(clamp('0.5', 0, 2, 1)).toBe(0.5);
    expect(clamp('loud', 0, 2, 1)).toBe(1);
  });
});

describe('normalizeSoul', () => {
  it('maps voice words, lowercases traits and caps them at four', () => {
    const s = normalizeSoul({
      ...JSON.parse(SOUL_JSON),
      traits: ['A', 'B', 'C', 'D', 'E'],
    });
    expect(s.pitch).toBe(1.35);
    expect(s.rate).toBe(1.15);
    expect(s.traits).toEqual(['a', 'b', 'c', 'd']);
  });

  it('strips stage directions and cuts a greeting back to a full sentence', () => {
    const s = normalizeSoul({
      name: 'Bo (grins)',
      greeting: 'Hi there! *yawns* I am a lamp and I',
      pitch: 3,
    });
    expect(s.name).toBe('Bo');
    expect(s.greeting).toBe('Hi there!');
    expect(s.pitch).toBe(1.6);
  });

  it('rejects souls without name or greeting', () => {
    expect(() => normalizeSoul({ name: 'Bo' })).toThrow('no name or greeting');
    expect(() => normalizeSoul('nope')).toThrow('not an object');
  });
});

describe('createSoul', () => {
  it('asks with the grammar and returns the parsed soul', async () => {
    const llm = fakeLlm([{ text: SOUL_JSON }]);
    const s = await createSoul(llm, 'sliding door', 'An orange and grey sliding door.');
    expect(s.name).toBe('Flibber');
    const request = llm.calls[0] as { grammar?: string; messages: { content: string }[] };
    expect(request.grammar).toContain('root ::=');
    expect(request.messages[1]!.content).toContain(
      'Object: sliding door. Looks: An orange and grey sliding door.',
    );
  });

  it('retries once after a bad reply, then gives up', async () => {
    const once = fakeLlm([{ text: '{"name":', finishReason: 'length' }, { text: SOUL_JSON }]);
    await expect(createSoul(once, 'door', 'A door.')).resolves.toMatchObject({ name: 'Flibber' });
    const never = fakeLlm([{ text: 'nope' }]);
    await expect(createSoul(never, 'door', 'A door.')).rejects.toThrow('valid JSON');
    expect(never.calls).toHaveLength(2);
  });
});

describe('dialogue', () => {
  it('keeps the last eight messages and never starts with the soul', () => {
    expect(trimHistory(turns(20))).toHaveLength(7);
    expect(trimHistory(turns(20))[0]!.role).toBe('user');
    expect(trimHistory([msg('assistant', 'hi')])).toEqual([]);
  });

  it('puts the soul, its memory and the safety rules in the system prompt', () => {
    const prompt = systemPrompt(soul([], 'Leo has a dog.'));
    expect(prompt).toContain('You are Tina, Queen of Breakfast');
    expect(prompt).toContain('Leo has a dog.');
    expect(prompt).toContain('never cruel or frightening');
    expect(systemPrompt(soul())).toContain('nothing yet');
  });

  it('streams a reply and returns it cleaned', async () => {
    const llm = fakeLlm([], ['Hello ', '(smiles) ', 'friend! And', ' then']);
    const deltas: string[] = [];
    const text = await reply(llm, soul(turns(3)), 'Hi Tina', d => deltas.push(d));
    expect(deltas.join('')).toBe('Hello (smiles) friend! And then');
    expect(text).toBe('Hello friend!');
    const { messages } = llm.calls[0] as { messages: { role: string; content: string }[] };
    expect(messages[0]!.role).toBe('system');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Hi Tina' });
  });
});

describe('memory compaction', () => {
  it('triggers only above sixteen messages', () => {
    expect(needsCompaction(turns(16))).toBe(false);
    expect(needsCompaction(turns(17))).toBe(true);
  });

  it('summarizes older messages and keeps the last six', async () => {
    const llm = fakeLlm([{ text: '  Tina knows Leo has a dog.  ' }]);
    const history = turns(18);
    const out = await compactMemory(llm, soul(history, 'Tina met Leo.'));
    expect(out.memory).toBe('Tina knows Leo has a dog.');
    expect(out.history).toEqual(history.slice(-6));
    const prompt = (llm.calls[0] as { messages: { content: string }[] }).messages[1]!.content;
    expect(prompt).toContain('Tina met Leo.');
    expect(prompt).toContain('m11');
    expect(prompt).not.toContain('m12');
  });

  it('keeps the previous memory if the model returns nothing', async () => {
    const out = await compactMemory(fakeLlm([{ text: '' }]), soul(turns(17), 'Old memory.'));
    expect(out.memory).toBe('Old memory.');
    expect(out.history).toHaveLength(6);
  });
});

describe('text clean-up', () => {
  it('removes bracketed, starred and cut-off stage directions', () => {
    expect(stripStageDirections('Hi (waves) there *sighs* [laughs] and (cut')).toBe('Hi there and');
  });

  it('cuts text back to its last full sentence', () => {
    expect(endAtSentence('One. Two! Thr')).toBe('One. Two!');
    expect(endAtSentence('No end at all')).toBe('No end at all');
  });

  it('describes a failed reply in one line', () => {
    expect(describeFailedOutput({ text: '', finishReason: 'length', tokens: 400 })).toBe(
      'Soul JSON failed: finish=length, 400 tokens. Output: (empty)',
    );
  });
});
