// Recording, Whisper or system speech recognition, system speech synthesis and the sentence splitter.
import { RECORDER_TYPES } from './probe';
import { log, timed } from './report';
import { runtime } from './runtime';

interface Speaker {
  name: string;
  pitch: number;
  rate: number;
}

type Transcriber = ((
  audio: Float32Array,
  options: object,
) => Promise<{ text: string } | { text: string }[]>) & {
  dispose(): Promise<void>;
};

const SAMPLE_RATE = 16000;
const MIN_SECONDS = 0.4;

let asr: Transcriber | null = null;
let micStream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let voices: SpeechSynthesisVoice[] = [];

// Hearing.

export async function loadSTT(modelId: string): Promise<void> {
  const { pipeline } = await import('@huggingface/transformers');
  const dtype =
    runtime.device === 'webgpu' ? ({ encoder_model: 'fp32', decoder_model_merged: 'q4' } as const) : 'q8';
  asr = await timed(
    `load.stt.${modelId.split('/').pop()}`,
    async () =>
      (await pipeline('automatic-speech-recognition', modelId, {
        device: runtime.device,
        dtype,
      })) as unknown as Transcriber,
  );
}

export async function unloadSTT(): Promise<void> {
  await asr?.dispose();
  asr = null;
}

// The mic stream is requested once and reused for every recording.
export async function startRecording(): Promise<void> {
  micStream ??= await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const type = RECORDER_TYPES.find(t => MediaRecorder.isTypeSupported(t));
  recorder = new MediaRecorder(micStream, type ? { mimeType: type } : undefined);
  chunks = [];
  recorder.ondataavailable = e => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start();
}

export function stopRecording(): Promise<Blob | null> {
  return new Promise(resolve => {
    const r = recorder;
    if (!r || r.state === 'inactive') return resolve(null);
    r.onstop = () => resolve(new Blob(chunks, { type: r.mimeType }));
    r.stop();
  });
}

async function toMono16k(blob: Blob): Promise<Float32Array> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * SAMPLE_RATE), SAMPLE_RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    return (await offline.startRendering()).getChannelData(0);
  } finally {
    void ctx.close();
  }
}

export async function transcribe(blob: Blob): Promise<string> {
  if (!asr) throw new Error('Load hearing first');
  const audio = await toMono16k(blob);
  if (audio.length < SAMPLE_RATE * MIN_SECONDS) return '';
  const out = await asr(audio, { language: 'english', task: 'transcribe' });
  return (Array.isArray(out) ? out.map(o => o.text).join(' ') : out.text).trim();
}

// System speech recognition (the Web Speech API), an alternative to Whisper that loads no model (ADR 0017).
// Minimal typings: TypeScript's DOM library does not declare it.
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionConstructor = new () => Recognition;

export const SYSTEM_STT = 'system';

function recognitionConstructor(): RecognitionConstructor | null {
  const g = globalThis as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export function hasSystemRecognition(): boolean {
  return recognitionConstructor() !== null;
}

let recognition: Recognition | null = null;
let heard: string[] = [];
let recognitionError: string | null = null;
let recognitionEnded: Promise<void> = Promise.resolve();

// Starts listening on press. Final results are collected until stopListening.
export function startListening(): void {
  const Ctor = recognitionConstructor();
  if (!Ctor) throw new Error('This browser has no speech recognition');
  const r = new Ctor();
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = false;
  heard = [];
  recognitionError = null;
  r.onresult = e => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]!;
      if (result.isFinal) heard.push(result[0].transcript);
    }
  };
  r.onerror = e => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') recognitionError = e.error;
  };
  recognitionEnded = new Promise(resolve => {
    r.onend = () => resolve();
  });
  recognition = r;
  r.start();
}

// Stops on release and resolves with what was heard once the recognizer delivers its last result.
export async function stopListening(): Promise<string> {
  const r = recognition;
  if (!r) return '';
  recognition = null;
  r.stop();
  await recognitionEnded;
  if (recognitionError) throw new Error(`Speech recognition: ${recognitionError}`);
  return heard.join(' ').trim();
}

// Speech.

// iOS only allows speech after a user gesture; call this from the Start tap.
export function unlockSpeech(): void {
  const loadVoices = () => {
    voices = speechSynthesis.getVoices();
  };
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', loadVoices);
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

export const englishVoices = () => voices.filter(v => v.lang.toLowerCase().startsWith('en'));

export function hashName(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// Deterministic per soul, so the same thing always sounds the same on a device.
function voiceFor(speaker: Speaker): SpeechSynthesisVoice | null {
  const pool = englishVoices();
  return pool.length ? pool[hashName(speaker.name) % pool.length]! : null;
}

// Queues one sentence; the browser plays queued utterances in order.
export function speak(text: string, speaker: Speaker, onStart?: () => void): void {
  const u = new SpeechSynthesisUtterance(text);
  const v = voiceFor(speaker);
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else {
    u.lang = 'en-US';
  }
  u.pitch = speaker.pitch;
  u.rate = speaker.rate;
  if (onStart) u.onstart = onStart;
  u.onerror = e => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') log(`TTS error: ${e.error}`);
  };
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  speechSynthesis.cancel();
}

// Sentence splitter.

const TERMINAL = '.!?…';
const CLOSING = '"\'”’»)';

// Emits a sentence once its terminal punctuation (plus any closing quotes) is followed by whitespace.
export function sentenceSplitter() {
  let buffer = '';
  return {
    push(delta: string): string[] {
      buffer += delta;
      const out: string[] = [];
      let from = 0;
      for (let i = 0; i < buffer.length; i++) {
        if (!TERMINAL.includes(buffer[i]!)) continue;
        let j = i + 1;
        while (j < buffer.length && (TERMINAL.includes(buffer[j]!) || CLOSING.includes(buffer[j]!))) j++;
        if (j < buffer.length && /\s/.test(buffer[j]!)) {
          const sentence = buffer.slice(from, j).trim();
          if (sentence) out.push(sentence);
          from = j;
        }
        i = j - 1;
      }
      buffer = buffer.slice(from);
      return out;
    },
    flush(): string[] {
      const rest = buffer.trim();
      buffer = '';
      return rest ? [rest] : [];
    },
  };
}
