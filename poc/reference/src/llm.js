// On-device LLM through WebLLM: soul creation, dialogue and memory compaction.
import * as webllm from 'https://esm.run/@mlc-ai/web-llm@0.2';
import { record, timed } from './report.js';

let engine = null;
let loadedId = null;

const WANTED = [/^Qwen2\.5-0\.5B-Instruct/, /^Qwen2\.5-1\.5B-Instruct/, /^Qwen2\.5-3B-Instruct/,
  /^Llama-3\.2-1B-Instruct/, /^Llama-3\.2-3B-Instruct/];

// Lists candidate models; devices without fp16 shaders need the q4f32 builds.
export function listModels(f16) {
  const suffix = f16 ? 'q4f16_1-MLC' : 'q4f32_1-MLC';
  return webllm.prebuiltAppConfig.model_list
    .filter(m => m.model_id.endsWith(suffix) && WANTED.some(r => r.test(m.model_id)))
    .map(m => ({ id: m.model_id, vramMB: Math.round(m.vram_required_MB ?? 0) }))
    .sort((a, b) => a.vramMB - b.vramMB);
}

export async function loadLLM(id, onProgress) {
  await timed(`load.llm.${id}`, async () => {
    if (engine) await engine.reload(id);
    else engine = await webllm.CreateMLCEngine(id, { initProgressCallback: p => onProgress(p.text) });
  });
  loadedId = id;
}

export async function unloadLLM() {
  await engine?.unload();
  engine = null;
  loadedId = null;
}

export const loadedModel = () => loadedId;

const SOUL_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    title: { type: 'string' },
    archetype: { type: 'string' },
    traits: { type: 'array', items: { type: 'string' } },
    style: { type: 'string' },
    catchphrase: { type: 'string' },
    secret: { type: 'string' },
    pitch: { type: 'number' },
    rate: { type: 'number' },
    greeting: { type: 'string' },
  },
  required: ['name', 'title', 'archetype', 'traits', 'style', 'catchphrase', 'secret', 'pitch', 'rate', 'greeting'],
};

function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('El modelo no devolvió JSON válido');
}

const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export async function createSoul(label, description) {
  const reply = await engine.chat.completions.create({
    temperature: 0.9,
    max_tokens: 400,
    response_format: { type: 'json_object', schema: JSON.stringify(SOUL_SCHEMA) },
    messages: [
      { role: 'system', content: 'Eres el director de un juego familiar en el que los objetos de una casa real cobran vida. Creas personajes memorables, variados y aptos para niños. Respondes solo con JSON.' },
      { role: 'user', content: `Objeto detectado: ${label}\nDescripción visual (en inglés): ${description}\n\nCrea el alma de este objeto, todo en español. Requisitos: un nombre propio original y divertido; un título épico corto; un arquetipo en pocas palabras; de 3 a 5 rasgos; style describe en una frase cómo habla; una muletilla corta; un secreto inofensivo; pitch entre 0.6 y 1.6 y rate entre 0.8 y 1.2 según su carácter; greeting es su primera frase al despertar y debe mencionar algo concreto de su aspecto.` },
    ],
  });
  const soul = parseJson(reply.choices[0].message.content);
  soul.traits = Array.isArray(soul.traits) ? soul.traits.slice(0, 5) : [];
  soul.pitch = clamp(soul.pitch, 0.6, 1.6, 1);
  soul.rate = clamp(soul.rate, 0.8, 1.2, 1);
  return soul;
}

function systemPrompt(soul) {
  return [
    `Eres ${soul.name}, ${soul.title}. Eres un objeto de una casa real que ha cobrado vida (${soul.label}).`,
    `Tu aspecto: ${soul.description}`,
    `Arquetipo: ${soul.archetype}. Rasgos: ${soul.traits.join(', ')}. Forma de hablar: ${soul.style}. Muletilla: "${soul.catchphrase}".`,
    `Tu secreto, que no cuentas fácilmente: ${soul.secret}.`,
    `Lo que recuerdas de conversaciones anteriores: ${soul.memory || 'nada todavía, acabas de despertar'}.`,
    'Reglas: responde en el idioma del jugador, en 1 a 3 frases cortas, sin emojis ni acotaciones entre asteriscos.',
    'Hablas con niños: sé divertido; puedes ser gruñón o dramático, pero nunca cruel ni aterrador.',
    'Nunca pidas datos personales ni propongas secretos frente a sus padres. Nunca sugieras tocar enchufes, fuego o cosas calientes, ni subirse a sitios altos.',
  ].join('\n');
}

// Streams a reply; onDelta receives text fragments as they arrive.
export async function chat(soul, userText, onDelta) {
  const start = performance.now();
  let first = true;
  let full = '';
  // Chat templates expect a user turn right after the system prompt.
  const past = soul.history.slice(-8);
  while (past[0]?.role === 'assistant') past.shift();
  const stream = await engine.chat.completions.create({
    stream: true,
    temperature: 0.8,
    max_tokens: 160,
    messages: [
      { role: 'system', content: systemPrompt(soul) },
      ...past,
      { role: 'user', content: userText },
    ],
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (!delta) continue;
    if (first) { record('llm.firstToken', performance.now() - start); first = false; }
    full += delta;
    onDelta(delta);
  }
  record('llm.fullReply', performance.now() - start);
  return full.trim();
}

// Folds older turns into the soul's memory summary and keeps the last six turns.
export async function compactMemory(soul) {
  const old = soul.history.slice(0, -6);
  const transcript = old.map(m => `${m.role === 'user' ? 'Niño' : soul.name}: ${m.content}`).join('\n');
  const reply = await engine.chat.completions.create({
    temperature: 0.3,
    max_tokens: 200,
    messages: [
      { role: 'system', content: 'Resumes recuerdos de un personaje. Escribes en español, en tercera persona, de 3 a 5 frases, solo hechos concretos.' },
      { role: 'user', content: `Recuerdos previos de ${soul.name}: ${soul.memory || 'ninguno'}\n\nConversación nueva:\n${transcript}\n\nEscribe el resumen actualizado de lo que ${soul.name} debe recordar.` },
    ],
  });
  return { ...soul, memory: reply.choices[0].message.content.trim(), history: soul.history.slice(-6) };
}
