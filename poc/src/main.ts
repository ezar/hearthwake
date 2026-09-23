// UI wiring for the Hearthwake M0 feasibility spike: busy state, button enablement and flows.
import './styles.css';
import * as cam from './camera';
import * as llm from './llm';
import { probeDevice, type ProbeResult } from './probe';
import { buildReport, initLog, log, record, timed } from './report';
import { runtime } from './runtime';
import * as souls from './souls';
import type { Soul } from './souls';
import * as vlm from './vlm';
import * as voice from './voice';

type ModelKey = 'detector' | 'vlm' | 'llm' | 'stt';
const MODEL_KEYS: ModelKey[] = ['detector', 'vlm', 'llm', 'stt'];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => $<HTMLButtonElement>(id);

// Loaded model ids, or null when not loaded.
const loaded: Record<ModelKey, string | null> = { detector: null, vlm: null, llm: null, stt: null };
let probe: ProbeResult | null = null;
let soul: Soul | null = null;
let busy = false;
let cameraOpen = false;

initLog($('log'));

function setStatus(key: ModelKey, text: string, isError = false): void {
  const el = $(`st-${key}`);
  el.textContent = text;
  el.classList.toggle('error', isError);
}

// The one place that decides what can be pressed.
function refreshButtons(): void {
  const started = !!probe;
  for (const key of MODEL_KEYS) {
    button(`load-${key}`).disabled = !started || busy;
    button(`free-${key}`).disabled = !loaded[key] || busy;
  }
  $<HTMLSelectElement>('llm-model').disabled = !started || busy;
  $<HTMLSelectElement>('stt-model').disabled = !started || busy;
  button('btn-start').disabled = busy;
  button('btn-camera').disabled = !started || busy || cameraOpen;
  button('btn-detect').disabled = !cameraOpen || !loaded.detector;
  button('btn-center').disabled = !cameraOpen;
  button('btn-wake').disabled = busy || !cam.getSelected() || !loaded.vlm || !loaded.llm;
  const canTalk = !busy && !!soul && !!loaded.llm;
  button('btn-talk').disabled = !canTalk || !loaded.stt;
  $<HTMLInputElement>('text-input').disabled = !canTalk;
  button('btn-send').disabled = !canTalk;
  button('btn-forget').disabled = busy || !soul;
  button('btn-report').disabled = !started;
}

async function withBusy(fn: () => Promise<void>): Promise<void> {
  busy = true;
  refreshButtons();
  try {
    await fn();
  } catch (e) {
    log(`Error: ${(e as Error).message}`);
    console.error(e);
  } finally {
    busy = false;
    refreshButtons();
  }
}

// Device: the Iniciar tap is also the gesture that unlocks speech on iOS.
button('btn-start').addEventListener('click', () =>
  withBusy(async () => {
    voice.unlockSpeech();
    probe = await probeDevice();
    runtime.device = probe.webgpu ? 'webgpu' : 'wasm';
    runtime.f16 = probe.shaderF16;
    $('probe-out').textContent = JSON.stringify(probe, null, 2);
    log(`Runtime: ${runtime.device}${runtime.f16 ? ' + fp16' : ''}`);

    const models = await llm.listModels(runtime.f16);
    const picker = $<HTMLSelectElement>('llm-model');
    picker.replaceChildren(...models.map(m => new Option(`${m.id} (${m.vramMB} MB)`, m.id)));
    const preferred = models.find(m => llm.DEFAULT_MODEL.test(m.id)) ?? models[0];
    if (preferred) picker.value = preferred.id;

    setTimeout(() => log(`Spanish system voices: ${voice.spanishVoices().length}`), 1000);
    button('btn-start').textContent = 'Reanalizar';
    renderSoulList();
  }),
);

// Models: one Load and one Free per model.
const loaders: Record<ModelKey, () => Promise<string>> = {
  detector: async () => {
    await cam.loadDetector();
    return 'Xenova/yolos-tiny';
  },
  vlm: async () => {
    await vlm.loadVLM();
    return 'HuggingFaceTB/SmolVLM-256M-Instruct';
  },
  llm: async () => {
    // WebLLM runs only on WebGPU; see docs/decisions/0003-llm-without-webgpu.md.
    if (runtime.device !== 'webgpu') throw new Error('WebLLM necesita WebGPU y este navegador no lo tiene');
    const id = $<HTMLSelectElement>('llm-model').value;
    await llm.loadLLM(id, text => setStatus('llm', text));
    return id;
  },
  stt: async () => {
    const id = $<HTMLSelectElement>('stt-model').value;
    await voice.loadSTT(id);
    return id;
  },
};

const unloaders: Record<ModelKey, () => Promise<void>> = {
  detector: () => cam.unloadDetector(),
  vlm: () => vlm.unloadVLM(),
  llm: () => llm.unloadLLM(),
  stt: () => voice.unloadSTT(),
};

for (const key of MODEL_KEYS) {
  const load = document.querySelector<HTMLButtonElement>(`[data-load="${key}"]`)!;
  const free = document.querySelector<HTMLButtonElement>(`[data-free="${key}"]`)!;
  load.id = `load-${key}`;
  free.id = `free-${key}`;

  load.addEventListener('click', () =>
    withBusy(async () => {
      setStatus(key, `Cargando en ${runtime.device}…`);
      const start = performance.now();
      try {
        // Loading over a loaded model frees the old one first, so memory figures stay honest.
        if (loaded[key] && key !== 'llm') await unloaders[key]();
        loaded[key] = await loaders[key]();
        const seconds = ((performance.now() - start) / 1000).toFixed(1);
        setStatus(key, `${loaded[key]!.split('/').pop()} en ${runtime.device}, ${seconds} s`);
      } catch (e) {
        loaded[key] = null;
        setStatus(key, (e as Error).message, true);
        throw e;
      }
    }),
  );

  free.addEventListener('click', () =>
    withBusy(async () => {
      if (key === 'detector') stopDetectionUi();
      await unloaders[key]();
      loaded[key] = null;
      setStatus(key, 'Liberado');
      log(`Unloaded ${key}`);
    }),
  );
}

// Camera and detection.
cam.initCamera($<HTMLVideoElement>('video'), $<HTMLCanvasElement>('overlay'), sel => {
  $('selected').textContent = sel
    ? `Seleccionado: ${sel.label}${
        sel.label === cam.CENTRE_LABEL ? ' (centro de la imagen)' : ` (${Math.round(sel.score * 100)}%)`
      }.`
    : 'Toca un objeto enmarcado, o usa el centro si no lo reconoce.';
  refreshButtons();
});

button('btn-camera').addEventListener('click', () =>
  withBusy(async () => {
    await cam.startCamera();
    cameraOpen = true;
    button('btn-camera').textContent = 'Cámara abierta';
  }),
);

function onDetectionStats(s: cam.DetectionStats | null): void {
  $('det-stats').textContent = s
    ? `${s.fps} fps, ${s.ms} ms por fotograma, ${s.count} objetos`
    : 'Detector parado';
  if (!s) button('btn-detect').textContent = 'Detectar';
}

function startDetectionUi(): void {
  cam.startDetection(onDetectionStats);
  button('btn-detect').textContent = 'Parar';
}

function stopDetectionUi(): void {
  cam.stopDetection();
  button('btn-detect').textContent = 'Detectar';
}

button('btn-detect').addEventListener('click', () => {
  try {
    if (cam.isDetecting()) stopDetectionUi();
    else startDetectionUi();
  } catch (e) {
    log((e as Error).message);
  }
});

button('btn-center').addEventListener('click', () => cam.selectCentre());

// Waking a thing: crop, describe, create the soul, greet.
button('btn-wake').addEventListener('click', () =>
  withBusy(async () => {
    const sel = cam.getSelected();
    const crop = cam.cropSelected();
    if (!sel || !crop) throw new Error('No hay imagen de la cámara');
    // Detection is paused so the wake timings measure the models alone.
    const wasDetecting = cam.isDetecting();
    if (wasDetecting) stopDetectionUi();
    const start = performance.now();
    log(`Waking ${sel.label}…`);
    try {
      const description = await timed('wake.describe', () => vlm.describe(crop));
      log(`VLM: ${description}`);
      const profile = await timed('wake.createSoul', () => llm.createSoul(sel.label, description));
      soul = {
        ...profile,
        id: crypto.randomUUID(),
        label: sel.label,
        description,
        thumbnail: crop.toDataURL('image/jpeg', 0.7),
        memory: '',
        history: [{ role: 'assistant', content: profile.greeting }],
        createdAt: Date.now(),
      };
      souls.saveSoul(soul);
      record('wake.total', performance.now() - start);
    } finally {
      if (wasDetecting && loaded.detector) startDetectionUi();
    }
    renderSoulList();
    $('transcript').replaceChildren();
    renderSoul(true);
    addBubble('soul', soul.greeting);
    voice.speak(soul.greeting, soul);
  }),
);

// Saved souls.
function renderSoulList(): void {
  const list = souls.listSouls();
  const picker = $<HTMLSelectElement>('soul-list');
  picker.replaceChildren(
    new Option(list.length ? 'Elige un alma despierta' : 'Ninguna alma despierta', ''),
    ...list.map(s => new Option(`${s.name}, ${s.label}`, s.id)),
  );
  picker.value = soul?.id ?? '';
}

$<HTMLSelectElement>('soul-list').addEventListener('change', e => {
  const id = (e.target as HTMLSelectElement).value;
  voice.stopSpeaking();
  soul = id ? souls.getSoul(id) : null;
  $('transcript').replaceChildren();
  soul?.history.forEach(m => addBubble(m.role === 'user' ? 'user' : 'soul', m.content));
  renderSoul(false);
  refreshButtons();
});

button('btn-forget').addEventListener('click', () => {
  if (!soul || !confirm(`¿Olvidar a ${soul.name}? No se puede deshacer.`)) return;
  voice.stopSpeaking();
  souls.forgetSoul(soul.id);
  log(`Forgot ${soul.name}`);
  soul = null;
  $('transcript').replaceChildren();
  renderSoul(false);
  renderSoulList();
  refreshButtons();
});

function renderSoul(waking: boolean): void {
  const card = $('soul-card');
  card.hidden = !soul;
  if (!soul) return;
  $<HTMLImageElement>('soul-img').src = soul.thumbnail;
  $<HTMLImageElement>('soul-img').alt = soul.label;
  $('soul-name').textContent = soul.name;
  $('soul-title').textContent = `${soul.title}. ${soul.archetype}.`;
  $('soul-traits').textContent = `${soul.traits.join(', ')}. «${soul.catchphrase}»`;
  $('soul-memory').textContent = soul.memory || 'Todavía nada.';
  card.classList.remove('waking');
  if (waking) {
    void card.offsetWidth; // Restart the animation.
    card.classList.add('waking');
  }
}

function addBubble(kind: 'user' | 'soul', text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `bubble ${kind}`;
  el.textContent = text;
  const transcript = $('transcript');
  transcript.append(el);
  transcript.scrollTop = transcript.scrollHeight;
  return el;
}

// Talking: streamed reply spoken sentence by sentence.
async function reply(text: string, releasedAt: number | null): Promise<void> {
  if (!soul) return;
  const current = soul;
  addBubble('user', text);
  const bubble = addBubble('soul', '');
  const splitter = voice.sentenceSplitter();
  const start = performance.now();
  let spoken = false;
  const onStart = () => {
    if (spoken) return;
    spoken = true;
    record('talk.firstAudioFromText', performance.now() - start);
    if (releasedAt !== null) record('talk.firstAudioFromRelease', performance.now() - releasedAt);
  };
  const say = (sentences: string[]) => sentences.forEach(s => voice.speak(s, current, onStart));
  const full = await llm.chat(current, text, delta => {
    bubble.textContent += delta;
    $('transcript').scrollTop = $('transcript').scrollHeight;
    say(splitter.push(delta));
  });
  say(splitter.flush());
  let next: Soul = {
    ...current,
    history: [...current.history, { role: 'user', content: text }, { role: 'assistant', content: full }],
  };
  if (llm.needsCompaction(next.history)) {
    next = await timed('memory.compact', () => llm.compactMemory(next));
    log(`Memory: ${next.memory}`);
  }
  souls.saveSoul(next);
  if (soul?.id === next.id) {
    soul = next;
    renderSoul(false);
  }
}

// Push to talk. `pressed` covers releases that happen while the mic is still starting.
const talk = button('btn-talk');
let pressed = false;
let recording = false;

talk.addEventListener('contextmenu', e => e.preventDefault());

talk.addEventListener('pointerdown', async e => {
  if (talk.disabled || pressed) return;
  e.preventDefault();
  pressed = true;
  talk.setPointerCapture?.(e.pointerId);
  voice.stopSpeaking();
  try {
    await voice.startRecording();
  } catch (err) {
    pressed = false;
    log(`Mic error: ${(err as Error).message}`);
    return;
  }
  recording = true;
  talk.classList.add('recording');
  talk.textContent = 'Escuchando… suelta para enviar';
  if (!pressed) void endTalk();
});

async function endTalk(): Promise<void> {
  pressed = false;
  if (!recording) return;
  recording = false;
  const releasedAt = performance.now();
  talk.classList.remove('recording');
  talk.textContent = 'Mantén pulsado para hablar';
  const blob = await voice.stopRecording();
  if (!blob) return;
  await withBusy(async () => {
    const text = await timed('stt.transcribe', () => voice.transcribe(blob));
    if (!text) {
      log('No speech detected');
      return;
    }
    await reply(text, releasedAt);
  });
}

talk.addEventListener('pointerup', () => void endTalk());
talk.addEventListener('pointercancel', () => void endTalk());

$<HTMLFormElement>('text-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = $<HTMLInputElement>('text-input');
  const text = input.value.trim();
  if (!text || busy) return;
  input.value = '';
  voice.stopSpeaking();
  void withBusy(() => reply(text, null));
});

// Report.
button('btn-report').addEventListener('click', async () => {
  const json = JSON.stringify(buildReport(probe, { ...loaded }), null, 2);
  try {
    await navigator.clipboard.writeText(json);
    log('Report copied to clipboard');
  } catch {
    log('Clipboard unavailable, report below');
    $('log').textContent = json;
  }
});

window.addEventListener('error', e => log(`Unhandled: ${e.message}`));
window.addEventListener('unhandledrejection', e => {
  const reason: unknown = e.reason;
  log(`Unhandled: ${reason instanceof Error ? reason.message : String(reason)}`);
});

renderSoulList();
refreshButtons();
log('Ready. Tap Iniciar.');
