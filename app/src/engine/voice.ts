// Speaking with system voices, hearing with the system speech recognizer (ADR 0017), and the sentence
// splitter that lets a reply be spoken while it is still being written.

export interface Speaker {
  name: string;
  pitch: number;
  rate: number;
}

let voices: SpeechSynthesisVoice[] = [];
let unlocked = false;

// iOS only allows speech after a user gesture; call this from the first tap.
export function unlockSpeech(): void {
  if (unlocked || !('speechSynthesis' in self)) return;
  unlocked = true;
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
  if (!('speechSynthesis' in self)) return;
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
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in self) speechSynthesis.cancel();
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

// Hearing: the Web Speech API. Minimal typings, since TypeScript's DOM library does not declare it.
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
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

// WebKit on iOS does not always fire `end` after stop(); waiting longer would leave the app stuck.
export const STOP_TIMEOUT_MS = 3000;

function recognitionConstructor(): RecognitionConstructor | null {
  const g = globalThis as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export const canHear = () => recognitionConstructor() !== null;

export interface Listening {
  // Resolves with what was heard once the recognizer has delivered its last result.
  stop(): Promise<string>;
}

// Starts listening; call stop() on release. onPartial gets what was heard so far, for live captions.
export function listen(onPartial?: (text: string) => void): Listening {
  const Ctor = recognitionConstructor();
  if (!Ctor) throw new Error('This browser cannot listen');
  const r = new Ctor();
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = !!onPartial;
  const finals: string[] = [];
  let error: string | null = null;
  const ended = new Promise<void>(resolve => {
    r.onend = () => resolve();
  });
  r.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]!;
      if (result.isFinal) finals.push(result[0].transcript.trim());
      else interim += result[0].transcript;
    }
    onPartial?.([...finals, interim.trim()].filter(Boolean).join(' '));
  };
  r.onerror = e => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') error = e.error;
  };
  r.start();
  return {
    async stop() {
      r.stop();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = await Promise.race([
        ended.then(() => false),
        new Promise<boolean>(resolve => (timer = setTimeout(() => resolve(true), STOP_TIMEOUT_MS))),
      ]);
      clearTimeout(timer);
      if (timedOut) r.abort();
      if (error === 'not-allowed' || error === 'service-not-allowed')
        throw new Error(
          'Hearthwake is not allowed to listen. Allow the microphone in your browser settings.',
        );
      if (error) throw new Error(`Could not hear you (${error})`);
      return finals.join(' ').trim();
    },
  };
}
