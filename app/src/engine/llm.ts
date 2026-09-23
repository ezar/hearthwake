// The on-device LLM (WebLLM): loading, soul creation, dialogue and memory. Prompts and parsing are ported
// from the M0 spike, where they were measured on the iPhone (ADRs 0004, 0005, 0013).
import type { MLCEngine } from '@mlc-ai/web-llm';
import type { ChatMessage, Soul, SoulProfile } from '../store/souls';
import { MAX_TRAITS, PITCHES, RATES, SOUL_FIELD_LIMITS, SOUL_GRAMMAR } from './grammar';
import { log, record, timed, withActivity } from './metrics';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  messages: Message[];
  temperature: number;
  max_tokens: number;
  grammar?: string;
}

export interface Completion {
  text: string;
  finishReason: string | null;
  tokens: number | null;
}

// The part of an LLM the app needs; WebLLM in the browser, a fake in tests and the mock engine.
export interface LlmBackend {
  load(onProgress: (fraction: number, text: string) => void): Promise<void>;
  complete(request: CompletionRequest): Promise<Completion>;
  stream(request: CompletionRequest): AsyncIterable<string>;
}

// The only model measured to work on the iPhone beside the camera and vision (docs/models.md).
export const MODEL_F16 = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
export const MODEL_F32 = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
// About what the q4f16 build downloads; shown on the first-run screen.
export const MODEL_DOWNLOAD_MB = 880;

// The KV cache is allocated for the whole window up front; 2048 fits every prompt here and saves memory on
// iOS (ADR 0005). Sliding windows are off, since WebLLM allows one or the other.
const CHAT_OPTIONS = { context_window_size: 2048, sliding_window_size: -1 };

// Whether the model's weights are already downloaded, so a returning visitor is not surprised by a
// download (for example after "Delete downloaded models").
export async function isModelCached(f16: boolean): Promise<boolean> {
  try {
    const { hasModelInCache } = await import('@mlc-ai/web-llm');
    return await hasModelInCache(f16 ? MODEL_F16 : MODEL_F32);
  } catch {
    return false;
  }
}

export function webLlmBackend(f16: boolean): LlmBackend {
  const modelId = f16 ? MODEL_F16 : MODEL_F32;
  let engine: MLCEngine | null = null;
  const requireEngine = () => {
    if (!engine) throw new Error('The model is not loaded');
    return engine;
  };
  return {
    async load(onProgress) {
      const webllm = await import('@mlc-ai/web-llm');
      engine = await webllm.CreateMLCEngine(
        modelId,
        { initProgressCallback: p => onProgress(p.progress, p.text) },
        CHAT_OPTIONS,
      );
    },
    async complete({ messages, temperature, max_tokens, grammar }) {
      const reply = await requireEngine().chat.completions.create({
        messages,
        temperature,
        max_tokens,
        ...(grammar ? { response_format: { type: 'grammar' as const, grammar } } : {}),
      });
      const choice = reply.choices[0];
      return {
        text: choice?.message.content ?? '',
        finishReason: choice?.finish_reason ?? null,
        tokens: reply.usage?.completion_tokens ?? null,
      };
    },
    async *stream({ messages, temperature, max_tokens }) {
      const chunks = await requireEngine().chat.completions.create({
        stream: true,
        messages,
        temperature,
        max_tokens,
      });
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}

// Text clean-up.

// Removes stage directions like "(nods)", "*sighs*" or "[laughs]", including ones cut off at the end.
export function stripStageDirections(value: string): string {
  return value
    .replace(/\([^)]*\)?|\*[^*]*\*?|\[[^\]]*\]?/g, ' ')
    .replace(/\s+([.,!?…])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cuts text that stopped mid-sentence back to its last complete sentence, when it has one.
export function endAtSentence(value: string): string {
  if (/[.!?…]["'”’]?$/.test(value)) return value;
  const matches = [...value.matchAll(/[.!?…]["'”’]?(?=\s)/g)];
  const last = matches.at(-1);
  return last?.index === undefined ? value : value.slice(0, last.index + last[0].length);
}

// Soul creation.

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
    // Models sometimes wrap JSON in prose or code fences.
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

const clean = (v: unknown) => (typeof v === 'string' ? stripStageDirections(v) : '');

function voiceValue(value: unknown, words: Record<string, number>, min: number, max: number): number {
  return typeof value === 'string' && value in words ? words[value]! : clamp(value, min, max, 1);
}

export function normalizeSoul(raw: unknown): SoulProfile {
  if (!raw || typeof raw !== 'object') throw new Error('The generated soul is not an object');
  const r = raw as Record<string, unknown>;
  const soul: SoulProfile = {
    name: clean(r.name),
    title: clean(r.title),
    archetype: clean(r.archetype),
    traits: Array.isArray(r.traits)
      ? r.traits
          .map(t => clean(t).toLowerCase())
          .filter(Boolean)
          .slice(0, MAX_TRAITS)
      : [],
    style: clean(r.style),
    catchphrase: clean(r.catchphrase),
    secret: clean(r.secret),
    pitch: voiceValue(r.pitch, PITCHES, 0.6, 1.6),
    rate: voiceValue(r.rate, RATES, 0.8, 1.2),
    greeting: endAtSentence(clean(r.greeting)),
  };
  if (!soul.name || !soul.greeting) throw new Error('The generated soul has no name or greeting');
  return soul;
}

export function soulPrompt(label: string, description: string): Message[] {
  const L = SOUL_FIELD_LIMITS;
  return [
    {
      role: 'system',
      content:
        'You direct a family game in which the objects of a real home come to life. ' +
        'You create memorable, varied, child-friendly characters. You answer only with JSON.',
    },
    {
      role: 'user',
      // No worked example: Llama 3.2 1B copied its details into every soul (ADR 0013).
      content:
        `Object: ${label}. Looks: ${description}\n\n` +
        'Create the soul of this object in English, as JSON with these fields:\n' +
        `- name: an original, funny proper name (up to ${L.name} characters)\n` +
        `- title: a short epic title (up to ${L.title})\n` +
        `- archetype: a character type in a few words (up to ${L.archetype})\n` +
        `- traits: 3 or 4 one-word personality traits (up to ${L.trait} each)\n` +
        `- style: one short sentence on how it talks (up to ${L.style})\n` +
        `- catchphrase: a short catchphrase (up to ${L.catchphrase})\n` +
        `- secret: a harmless secret (up to ${L.secret})\n` +
        '- pitch: low, medium or high, to suit its character\n' +
        '- rate: slow, normal or fast, to suit its character\n' +
        `- greeting: one or two short sentences it says on waking up, a hello and not a goodbye, that ` +
        `mention how it looks (${description}) (up to ${L.greeting})\n` +
        'No stage directions and no text in brackets or asterisks.',
    },
  ];
}

export function describeFailedOutput({ text, finishReason, tokens }: Completion): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const preview = flat.length > 320 ? `${flat.slice(0, 200)} … ${flat.slice(-100)}` : flat;
  return `Soul JSON failed: finish=${finishReason ?? '?'}, ${tokens ?? '?'} tokens. Output: ${preview || '(empty)'}`;
}

const SOUL_ATTEMPTS = 2;

// Generates a soul, retrying once: a reply can still be cut off or malformed.
export async function createSoul(llm: LlmBackend, label: string, description: string): Promise<SoulProfile> {
  return withActivity('create a soul', () =>
    timed('wake.createSoul', async () => {
      for (let attempt = 1; ; attempt++) {
        const reply = await llm.complete({
          messages: soulPrompt(label, description),
          temperature: 0.9,
          max_tokens: 400,
          grammar: SOUL_GRAMMAR,
        });
        try {
          return normalizeSoul(parseJson(reply.text));
        } catch (e) {
          log(describeFailedOutput(reply));
          if (attempt >= SOUL_ATTEMPTS) throw e;
        }
      }
    }),
  );
}

// Dialogue.

export const HISTORY_WINDOW = 8;
export const COMPACT_ABOVE = 16;
export const KEEP_AFTER_COMPACT = 6;

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
export function trimHistory(history: readonly ChatMessage[], size = HISTORY_WINDOW): Message[] {
  const recent = history.slice(-size).map(({ role, content }) => ({ role, content }));
  while (recent[0]?.role === 'assistant') recent.shift();
  return recent;
}

// Streams a reply; onDelta receives text fragments as they arrive. Returns the cleaned full reply.
export async function reply(
  llm: LlmBackend,
  soul: Soul,
  userText: string,
  onDelta: (delta: string) => void,
): Promise<string> {
  return withActivity('reply', async () => {
    const start = performance.now();
    let first = true;
    let full = '';
    for await (const delta of llm.stream({
      messages: [
        { role: 'system', content: systemPrompt(soul) },
        ...trimHistory(soul.history),
        { role: 'user', content: userText },
      ],
      temperature: 0.8,
      max_tokens: 160,
    })) {
      if (first) {
        record('llm.firstToken', performance.now() - start);
        first = false;
      }
      full += delta;
      onDelta(delta);
    }
    record('llm.fullReply', performance.now() - start);
    return endAtSentence(stripStageDirections(full));
  });
}

// Memory.

export const needsCompaction = (history: readonly ChatMessage[]) => history.length > COMPACT_ABOVE;

// Folds everything but the last few messages into the memory summary.
export async function compactMemory(llm: LlmBackend, soul: Soul): Promise<Soul> {
  const older = soul.history.slice(0, -KEEP_AFTER_COMPACT);
  const transcript = older.map(m => `${m.role === 'user' ? 'Player' : soul.name}: ${m.content}`).join('\n');
  const { text } = await timed('memory.compact', () =>
    llm.complete({
      temperature: 0.3,
      max_tokens: 220,
      messages: [
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
      ],
    }),
  );
  return { ...soul, memory: text.trim() || soul.memory, history: soul.history.slice(-KEEP_AFTER_COMPACT) };
}
