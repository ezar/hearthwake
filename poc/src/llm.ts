// On-device LLM through WebLLM: model list, loading, soul creation, dialogue and memory compaction.
import type { ChatCompletion, ChatCompletionRequestNonStreaming, MLCEngine } from '@mlc-ai/web-llm';
import { log, record, timed } from './report';
import type { ChatMessage, Soul, SoulProfile } from './souls';

export interface ModelOption {
  id: string;
  vramMB: number;
}

// The subset of the engine that soul creation and compaction use, so tests can mock it.
export interface CompletionEngine {
  chat: { completions: { create(request: ChatCompletionRequestNonStreaming): Promise<ChatCompletion> } };
}

export const HISTORY_WINDOW = 8;
export const COMPACT_ABOVE = 16;
export const KEEP_AFTER_COMPACT = 6;

// Qwen3 emits thinking tokens, so it is left out. Gemma 3 1B is in: its template rejects system
// prompts, so adaptMessages folds the system prompt into the first user turn (ADR 0009).
const WANTED = [
  /^Qwen2\.5-0\.5B-Instruct-/,
  /^Qwen2\.5-1\.5B-Instruct-/,
  /^Qwen2\.5-3B-Instruct-/,
  /^Llama-3\.2-1B-Instruct-/,
  /^Llama-3\.2-3B-Instruct-/,
  /^gemma3-1b-it-/,
];
// The only build measured to load on the iPhone so far (docs/models.md).
export const DEFAULT_MODEL = /^Llama-3\.2-1B-Instruct-/;

// The KV cache is allocated for the whole window up front. Prompts here (system prompt, eight history
// messages, a 160-token reply) fit well inside 2048, and halving WebLLM's usual 4096 saves memory on iOS.
// See docs/decisions/0005-llm-context-window.md.
export const CONTEXT_WINDOW = 2048;
// WebLLM allows a full context window or a sliding one, not both. Gemma 3's config brings a 512-token
// sliding window, and WebLLM's own record for it already asks for a full window, so turn sliding off.
// Models without a sliding window already have it at -1, so this changes nothing for them.
export const CHAT_OPTIONS = { context_window_size: CONTEXT_WINDOW, sliding_window_size: -1 };

let engine: MLCEngine | null = null;
let loadedId: string | null = null;
let progress: (text: string) => void = () => {};

export function filterModels(
  list: readonly { model_id: string; vram_required_MB?: number }[],
  f16: boolean,
): ModelOption[] {
  const suffix = f16 ? 'q4f16_1-MLC' : 'q4f32_1-MLC';
  return list
    .filter(m => m.model_id.endsWith(suffix) && WANTED.some(r => r.test(m.model_id)))
    .map(m => ({ id: m.model_id, vramMB: Math.round(m.vram_required_MB ?? 0) }))
    .sort((a, b) => a.vramMB - b.vramMB);
}

export async function listModels(f16: boolean): Promise<ModelOption[]> {
  const { prebuiltAppConfig } = await import('@mlc-ai/web-llm');
  return filterModels(prebuiltAppConfig.model_list, f16);
}

// The engine is created once; later loads, including after Free, reuse it with reload.
export async function loadLLM(id: string, onProgress: (text: string) => void): Promise<void> {
  progress = onProgress;
  await timed(`load.llm.${id}`, async () => {
    if (engine) {
      await engine.reload(id, CHAT_OPTIONS);
    } else {
      const webllm = await import('@mlc-ai/web-llm');
      engine = await webllm.CreateMLCEngine(
        id,
        { initProgressCallback: p => progress(p.text) },
        CHAT_OPTIONS,
      );
    }
  });
  loadedId = id;
}

export async function unloadLLM(): Promise<void> {
  await engine?.unload();
  loadedId = null;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Gemma's chat template has no system role: its instructions go at the top of the first user turn.
export function adaptMessages(modelId: string, messages: Message[]): Message[] {
  const [system, ...rest] = messages;
  if (!/^gemma/i.test(modelId) || system?.role !== 'system') return messages;
  const [first, ...others] = rest;
  if (first?.role !== 'user') return [{ role: 'user', content: system.content }, ...rest];
  return [{ role: 'user', content: `${system.content}\n\n${first.content}` }, ...others];
}

const forModel = (messages: Message[]) =>
  adaptMessages(loadedId ?? '', messages) as ChatCompletionRequestNonStreaming['messages'];

function requireEngine(): MLCEngine {
  if (!engine || !loadedId) throw new Error('Load the LLM first');
  return engine;
}

// Soul creation.

// Every string and the traits list are bounded. On the iPhone, Gemma 3 1B looped inside an unbounded
// traits array until it ran out of tokens. The bundled XGrammar honours these keywords (ADR 0011).
const text_ = (maxLength: number) => ({ type: 'string', maxLength });
export const SOUL_SCHEMA = {
  type: 'object',
  properties: {
    name: text_(30),
    title: text_(60),
    archetype: text_(60),
    traits: { type: 'array', items: text_(30), minItems: 3, maxItems: 5 },
    style: text_(120),
    catchphrase: text_(80),
    secret: text_(120),
    pitch: { type: 'number' },
    rate: { type: 'number' },
    greeting: text_(200),
  },
  required: [
    'name',
    'title',
    'archetype',
    'traits',
    'style',
    'catchphrase',
    'secret',
    'pitch',
    'rate',
    'greeting',
  ],
};

// One complete soul, so small models see the shape and tone instead of guessing from field names.
const SOUL_EXAMPLE = {
  name: 'Lady Porcelain',
  title: 'Queen of Breakfast',
  archetype: 'Vain grandmother',
  traits: ['warm', 'gossipy', 'a bit dramatic'],
  style: 'Speaks slowly and sighs whenever her tea goes cold.',
  catchphrase: 'Nice and toasty!',
  secret: 'She has a tiny crack nobody has noticed.',
  pitch: 1.3,
  rate: 0.9,
  greeting: 'Ooh, it is chilly! Has anyone seen my golden handle shine? Hello, sweetheart!',
};

// Returns the first balanced {...} block, ignoring braces inside strings.
export function extractFirstObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Fall through to extraction: models sometimes wrap JSON in prose or code fences.
  }
  const block = extractFirstObject(text);
  if (block) {
    try {
      return JSON.parse(block);
    } catch {
      // Reported below.
    }
  }
  throw new Error('The model did not return valid JSON');
}

export function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function normalizeSoul(raw: unknown): SoulProfile {
  if (!raw || typeof raw !== 'object') throw new Error('The generated soul is not an object');
  const r = raw as Record<string, unknown>;
  const soul: SoulProfile = {
    name: text(r.name),
    title: text(r.title),
    archetype: text(r.archetype),
    traits: Array.isArray(r.traits) ? r.traits.map(text).filter(Boolean).slice(0, 5) : [],
    style: text(r.style),
    catchphrase: text(r.catchphrase),
    secret: text(r.secret),
    pitch: clamp(r.pitch, 0.6, 1.6, 1),
    rate: clamp(r.rate, 0.8, 1.2, 1),
    greeting: text(r.greeting),
  };
  if (!soul.name || !soul.greeting) throw new Error('The generated soul has no name or greeting');
  return soul;
}

export async function createSoul(label: string, description: string): Promise<SoulProfile> {
  const reply = await requireEngine().chat.completions.create({
    temperature: 0.9,
    // The bounded schema tops out at roughly 300 tokens; leave some room.
    max_tokens: 450,
    response_format: { type: 'json_object', schema: JSON.stringify(SOUL_SCHEMA) },
    messages: forModel([
      {
        role: 'system',
        content:
          'You direct a family game in which the objects of a real home come to life. ' +
          'You create memorable, varied, child-friendly characters. You answer only with JSON.',
      },
      {
        role: 'user',
        content:
          'Example for a white cup with a golden handle:\n' +
          `${JSON.stringify(SOUL_EXAMPLE)}\n\n` +
          `Now the real object. Object: ${label}. Looks: ${description}\n\n` +
          'Create its soul in English, different from the example: an original, funny proper name; ' +
          'a short epic title; an archetype in a few words; 3 to 5 personality traits (adjectives); ' +
          'style says in one sentence how it talks; a short catchphrase; a harmless secret; pitch between 0.6 ' +
          'and 1.6 and rate between 0.8 and 1.2 to suit its character; greeting is what it says on waking up, ' +
          'a hello and not a goodbye, and mentions something concrete about how it looks.',
      },
    ]),
  });
  const choice = reply.choices[0];
  const text = choice?.message.content ?? '';
  try {
    return normalizeSoul(parseJson(text));
  } catch (e) {
    // Small models can run out of tokens mid-JSON; log what came back so the cause is visible.
    log(describeFailedOutput(text, choice?.finish_reason ?? null, reply.usage?.completion_tokens ?? null));
    if (choice?.finish_reason === 'length')
      throw new Error('The model ran out of tokens before finishing the soul', { cause: e });
    throw e;
  }
}

// A one-line summary of a reply that could not be parsed: why it stopped, its size, its start and end.
export function describeFailedOutput(
  text: string,
  finishReason: string | null,
  tokens: number | null,
): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const preview = flat.length > 320 ? `${flat.slice(0, 200)} … ${flat.slice(-100)}` : flat;
  return (
    `Soul JSON failed: finish=${finishReason ?? '?'}, ${tokens ?? '?'} tokens, ${text.length} chars. ` +
    `Output: ${preview || '(empty)'}`
  );
}

// Dialogue.

export function systemPrompt(soul: Soul): string {
  return [
    `You are ${soul.name}, ${soul.title}. You are an object in a real home that has come to life (${soul.label}).`,
    `How you look: ${soul.description}`,
    `Archetype: ${soul.archetype}. Traits: ${soul.traits.join(', ')}. How you talk: ${soul.style}. ` +
      `Catchphrase: "${soul.catchphrase}".`,
    `Your secret, which you do not share easily: ${soul.secret}.`,
    `What you remember from earlier conversations: ${soul.memory || 'nothing yet, you have just woken up'}.`,
    'Rules: answer in English, in 1 to 3 short sentences, with no emojis or stage directions.',
    'You are talking with children: be fun; you may be grumpy or dramatic, but never cruel or frightening.',
    'Never ask for personal details and never suggest keeping secrets from parents.',
    'Never suggest touching sockets, fire or hot things, or climbing on anything.',
  ].join('\n');
}

// Last messages of the history; chat templates need a user turn right after the system prompt.
export function trimHistory(history: readonly ChatMessage[], size = HISTORY_WINDOW): ChatMessage[] {
  const recent = history.slice(-size);
  while (recent[0]?.role === 'assistant') recent.shift();
  return recent;
}

// Streams a reply; onDelta receives text fragments as they arrive.
export async function chat(soul: Soul, userText: string, onDelta: (delta: string) => void): Promise<string> {
  const start = performance.now();
  let first = true;
  let full = '';
  const stream = await requireEngine().chat.completions.create({
    stream: true,
    temperature: 0.8,
    max_tokens: 160,
    messages: forModel([
      { role: 'system', content: systemPrompt(soul) },
      ...trimHistory(soul.history),
      { role: 'user', content: userText },
    ]),
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (!delta) continue;
    if (first) {
      record('llm.firstToken', performance.now() - start);
      first = false;
    }
    full += delta;
    onDelta(delta);
  }
  record('llm.fullReply', performance.now() - start);
  return full.trim();
}

// Memory.

export const needsCompaction = (history: readonly ChatMessage[]) => history.length > COMPACT_ABOVE;

// Folds everything but the last six messages into the memory summary.
export async function compactMemory(soul: Soul, llm: CompletionEngine = requireEngine()): Promise<Soul> {
  const older = soul.history.slice(0, -KEEP_AFTER_COMPACT);
  const transcript = older.map(m => `${m.role === 'user' ? 'Player' : soul.name}: ${m.content}`).join('\n');
  const reply = await llm.chat.completions.create({
    temperature: 0.3,
    max_tokens: 220,
    messages: forModel([
      {
        role: 'system',
        content:
          'You summarize the memories of a character. You write in English, in the third person, ' +
          '3 to 5 sentences, concrete facts only.',
      },
      {
        role: 'user',
        content:
          `Earlier memories of ${soul.name}: ${soul.memory || 'none'}\n\nNew conversation:\n${transcript}\n\n` +
          `Write the updated summary of what ${soul.name} should remember, merging the earlier and new memories.`,
      },
    ]),
  });
  const memory = reply.choices[0]?.message.content?.trim() || soul.memory;
  return { ...soul, memory, history: soul.history.slice(-KEEP_AFTER_COMPACT) };
}
