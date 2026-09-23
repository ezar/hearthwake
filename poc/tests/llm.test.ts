import { describe, expect, it, vi } from 'vitest';
import {
  CHAT_OPTIONS,
  SOUL_SCHEMA,
  adaptMessages,
  clamp,
  compactMemory,
  describeFailedOutput,
  extractFirstObject,
  filterModels,
  needsCompaction,
  normalizeSoul,
  parseJson,
  trimHistory,
  type CompletionEngine,
} from '../src/llm';
import type { ChatMessage, Soul } from '../src/souls';

const msg = (role: ChatMessage['role'], content: string): ChatMessage => ({ role, content });
const turns = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => msg(i % 2 ? 'user' : 'assistant', `m${i}`));

describe('parseJson', () => {
  it('parses clean JSON', () => {
    expect(parseJson('{"name":"Lola"}')).toEqual({ name: 'Lola' });
  });

  it('extracts the first object from prose and code fences', () => {
    expect(parseJson('Aquí está:\n```json\n{"name":"Lola"}\n```\nY otro {"x":1}')).toEqual({ name: 'Lola' });
  });

  it('ignores braces inside strings', () => {
    expect(extractFirstObject('x {"a":"}{","b":{"c":1}} y')).toBe('{"a":"}{","b":{"c":1}}');
    expect(extractFirstObject('{"a":"say \\"}\\""} tail')).toBe('{"a":"say \\"}\\""}');
  });

  it('fails with a clear error when there is no usable object', () => {
    expect(() => parseJson('no json here')).toThrow('The model did not return valid JSON');
    expect(() => parseJson('{"name": "Lola"')).toThrow('The model did not return valid JSON');
    expect(() => parseJson('{name: Lola}')).toThrow('The model did not return valid JSON');
  });
});

describe('clamp', () => {
  it('clamps into range', () => {
    expect(clamp(2, 0.6, 1.6, 1)).toBe(1.6);
    expect(clamp(0.1, 0.8, 1.2, 1)).toBe(0.8);
    expect(clamp(1.1, 0.8, 1.2, 1)).toBe(1.1);
  });

  it('accepts numeric strings and falls back on garbage', () => {
    expect(clamp('1.3', 0.6, 1.6, 1)).toBe(1.3);
    expect(clamp('alto', 0.6, 1.6, 1)).toBe(1);
    expect(clamp(NaN, 0.6, 1.6, 1)).toBe(1);
    expect(clamp(undefined, 0.6, 1.6, 1)).toBe(1);
  });
});

describe('normalizeSoul', () => {
  const raw = {
    name: ' Lola ',
    title: 'Guardiana de la luz',
    archetype: 'Sabia despistada',
    traits: ['curiosa', 'dramática', '', 'gruñona', 'amable', 'lenta', 'extra'],
    style: 'Habla en susurros',
    catchphrase: '¡Por mil bombillas!',
    secret: 'Le da miedo la oscuridad',
    pitch: 3,
    rate: 0.2,
    greeting: '¡Mi pantalla verde brilla otra vez!',
  };

  it('trims, caps traits at five and clamps voice values', () => {
    const soul = normalizeSoul(raw);
    expect(soul.name).toBe('Lola');
    expect(soul.traits).toEqual(['curiosa', 'dramática', 'gruñona', 'amable', 'lenta']);
    expect(soul.pitch).toBe(1.6);
    expect(soul.rate).toBe(0.8);
  });

  it('rejects souls without name or greeting', () => {
    expect(() => normalizeSoul({ ...raw, name: '' })).toThrow();
    expect(() => normalizeSoul({ ...raw, greeting: undefined })).toThrow();
    expect(() => normalizeSoul(null)).toThrow();
  });
});

describe('trimHistory', () => {
  it('keeps the last eight messages', () => {
    const h = turns(13); // Last eight start with a user message.
    expect(trimHistory(h)).toEqual(h.slice(-8));
  });

  it('never starts with an assistant message', () => {
    expect(trimHistory([msg('assistant', 'hola')])).toEqual([]);
    const h = turns(10); // Last eight start with an assistant message.
    const out = trimHistory(h);
    expect(out[0]?.role).toBe('user');
    expect(out).toEqual(h.slice(-7));
  });
});

describe('filterModels', () => {
  const list = [
    { model_id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', vram_required_MB: 1600 },
    { model_id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', vram_required_MB: 1900 },
    { model_id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', vram_required_MB: 900 },
    { model_id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', vram_required_MB: 1600 },
    { model_id: 'Qwen3-1.7B-q4f16_1-MLC', vram_required_MB: 2000 },
    { model_id: 'gemma-2-2b-it-q4f16_1-MLC', vram_required_MB: 2000 },
    { model_id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', vram_required_MB: 1100 },
    { model_id: 'gemma3-1b-it-q4f16_1-MLC', vram_required_MB: 711 },
  ];

  it('keeps wanted families with the right quantization, sorted by memory', () => {
    expect(filterModels(list, true).map(m => m.id)).toEqual([
      'gemma3-1b-it-q4f16_1-MLC',
      'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
      'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    ]);
    expect(filterModels(list, false).map(m => m.id)).toEqual(['Qwen2.5-1.5B-Instruct-q4f32_1-MLC']);
  });
});

describe('memory compaction', () => {
  const soul = (history: ChatMessage[], memory = ''): Soul => ({
    id: 's1',
    label: 'cup',
    description: 'A red mug.',
    thumbnail: '',
    memory,
    history,
    createdAt: 0,
    name: 'Taza Tina',
    title: 'Reina del desayuno',
    archetype: 'Abuela cariñosa',
    traits: ['dulce'],
    style: 'Habla despacio',
    catchphrase: '¡Qué calentito!',
    secret: 'Tiene una grieta',
    pitch: 1,
    rate: 1,
    greeting: 'Hola',
  });

  it('triggers only above sixteen messages', () => {
    expect(needsCompaction(turns(16))).toBe(false);
    expect(needsCompaction(turns(17))).toBe(true);
  });

  it('summarizes older messages and keeps the last six', async () => {
    const create = vi
      .fn()
      .mockResolvedValue({ choices: [{ message: { content: '  Tina sabe que Leo tiene un perro.  ' } }] });
    const engine = { chat: { completions: { create } } } as unknown as CompletionEngine;
    const history = turns(18);
    const out = await compactMemory(soul(history, 'Tina conoció a Leo.'), engine);

    expect(out.memory).toBe('Tina sabe que Leo tiene un perro.');
    expect(out.history).toEqual(history.slice(-6));
    expect(out.id).toBe('s1');
    const prompt: string = create.mock.calls[0]![0].messages[1].content;
    expect(prompt).toContain('Tina conoció a Leo.');
    expect(prompt).toContain('m11');
    expect(prompt).not.toContain('m12');
  });

  it('keeps the previous memory if the model returns nothing', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: '' } }] });
    const engine = { chat: { completions: { create } } } as unknown as CompletionEngine;
    const out = await compactMemory(soul(turns(17), 'Recuerdo viejo.'), engine);
    expect(out.memory).toBe('Recuerdo viejo.');
    expect(out.history).toHaveLength(6);
  });
});

describe('adaptMessages', () => {
  const system = { role: 'system' as const, content: 'Eres Lola.' };
  const user = { role: 'user' as const, content: 'Hola' };
  const assistant = { role: 'assistant' as const, content: '¡Hola!' };

  it('leaves models with a system role untouched', () => {
    const messages = [system, user];
    expect(adaptMessages('Llama-3.2-1B-Instruct-q4f16_1-MLC', messages)).toBe(messages);
  });

  it('folds the system prompt into the first user turn for Gemma', () => {
    expect(adaptMessages('gemma3-1b-it-q4f16_1-MLC', [system, user, assistant, user])).toEqual([
      { role: 'user', content: 'Eres Lola.\n\nHola' },
      assistant,
      user,
    ]);
  });

  it('turns a lone system prompt into a user turn for Gemma', () => {
    expect(adaptMessages('gemma3-1b-it-q4f16_1-MLC', [system])).toEqual([
      { role: 'user', content: 'Eres Lola.' },
    ]);
  });
});

describe('CHAT_OPTIONS', () => {
  it('never sets both a context window and a sliding window (WebLLM rejects that for Gemma 3)', () => {
    expect(CHAT_OPTIONS.context_window_size).toBe(2048);
    expect(CHAT_OPTIONS.sliding_window_size).toBe(-1);
  });
});

describe('describeFailedOutput', () => {
  it('reports why generation stopped, its size and a flattened preview', () => {
    expect(describeFailedOutput('{\n  "name": "Remy",\n  "title": "Guar', 'length', 400)).toBe(
      'Soul JSON failed: finish=length, 400 tokens, 36 chars. Output: { "name": "Remy", "title": "Guar',
    );
  });

  it('keeps the start and end of long outputs', () => {
    const out = describeFailedOutput(`{${'a'.repeat(500)}}`, 'stop', null);
    expect(out).toContain('finish=stop, ? tokens, 502 chars');
    expect(out).toContain(' … ');
    expect(out.length).toBeLessThan(420);
  });

  it('marks empty output', () => {
    expect(describeFailedOutput('', null, 0)).toContain('Output: (empty)');
  });
});

describe('SOUL_SCHEMA', () => {
  it('bounds the traits list and every string, so a small model cannot loop until it runs out of tokens', () => {
    const props = SOUL_SCHEMA.properties as Record<
      string,
      {
        type: string;
        maxLength?: number;
        minItems?: number;
        maxItems?: number;
        items?: { maxLength?: number };
      }
    >;
    expect(props.traits).toMatchObject({ minItems: 3, maxItems: 5, items: { maxLength: 30 } });
    for (const [key, prop] of Object.entries(props)) {
      if (prop.type === 'string') expect(prop.maxLength, key).toBeGreaterThan(0);
    }
    expect(SOUL_SCHEMA.required).toHaveLength(Object.keys(props).length);
  });
});
