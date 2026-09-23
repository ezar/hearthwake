// Speech to text with Whisper, and text to speech with the system voices.
import { TRANSFORMERS, runtime } from './runtime.js';
import { log, timed } from './report.js';

const { pipeline } = await import(TRANSFORMERS);

let asr = null;
let micStream = null;
let recorder = null;
let chunks = [];
let voices = [];

export async function loadSTT(modelId) {
  const webgpu = runtime.device === 'webgpu';
  asr = await timed(`load.stt.${modelId.split('/').pop()}`, () =>
    pipeline('automatic-speech-recognition', modelId, {
      device: runtime.device,
      dtype: webgpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    }));
}

export async function unloadSTT() {
  await asr?.dispose?.();
  asr = null;
}

export async function startRecording() {
  micStream ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t));
  recorder = new MediaRecorder(micStream, type ? { mimeType: type } : undefined);
  chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.start();
}

export function stopRecording() {
  return new Promise(resolve => {
    if (!recorder || recorder.state === 'inactive') return resolve(null);
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.stop();
  });
}

async function toMono16k(blob) {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  return (await off.startRendering()).getChannelData(0);
}

export async function transcribe(blob, language = 'spanish') {
  const audio = await toMono16k(blob);
  if (audio.length < 16000 * 0.4) return '';
  const out = await asr(audio, { language, task: 'transcribe' });
  return out.text.trim();
}

// iOS only allows speech after a user gesture; call this from the first tap.
export function unlockSpeech() {
  const loadVoices = () => { voices = speechSynthesis.getVoices(); };
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function spanishVoices() {
  return voices.filter(v => v.lang.toLowerCase().startsWith('es'));
}

function voiceFor(soul) {
  const pool = spanishVoices();
  if (!pool.length) return null;
  let h = 0;
  for (const c of soul.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

// Queues one sentence; the browser plays queued utterances in order.
export function speak(text, soul, onStart) {
  const u = new SpeechSynthesisUtterance(text);
  const v = voiceFor(soul);
  if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'es-ES'; }
  u.pitch = soul.pitch;
  u.rate = soul.rate;
  if (onStart) u.onstart = onStart;
  u.onerror = e => log(`TTS error: ${e.error}`);
  speechSynthesis.speak(u);
}

export function stopSpeaking() { speechSynthesis.cancel(); }

// Splits streamed text into complete sentences so speech can start early.
export function sentenceSplitter() {
  let buffer = '';
  return {
    push(delta) {
      buffer += delta;
      const out = [];
      let m;
      while ((m = buffer.match(/^([\s\S]*?[.!?…]+)(\s+|$)/)) && m[2] !== '') {
        out.push(m[1].trim());
        buffer = buffer.slice(m[0].length);
      }
      return out;
    },
    flush() {
      const rest = buffer.trim();
      buffer = '';
      return rest ? [rest] : [];
    },
  };
}
