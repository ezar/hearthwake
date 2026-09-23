// UI wiring for the Hearthwake M0 feasibility spike: busy state, button enablement and flows.
// Must stay the first import: it instruments Response.json() before anything else runs.
import './diagnostics';
import './styles.css';
import { clearModelCaches, storageUsageMB } from './cache';
import * as cam from './camera';
import * as llm from './llm';
import { clearPending, loadPending, pendingStep, savePending, type PendingWake } from './pending';
import { probeDevice, type ProbeResult } from './probe';
import {
  beginActivity,
  buildReport,
  endActivity,
  initLog,
  log,
  record,
  restoreAfterCrash,
  timed,
} from './report';
import { DETECTORS, type DetectorChoice } from './detectors';
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
// Vision must not run in a page load where the LLM has been loaded (ADR 0014).
let llmUsedThisPage = false;

initLog($('log'));

// Where an error came from matters more than its message, which WebKit often makes generic.
const describeError = (err: unknown) =>
  err instanceof Error
    ? `${err.name}: ${err.message}${err.stack ? `\n  ${err.stack.split('\n').slice(0, 4).join('\n  ')}` : ''}`
    : String(err);

window.addEventListener('error', e => {
  const where = e.filename ? ` at ${e.filename}:${e.lineno}:${e.colno}` : '';
  log(`Unhandled error${where}: ${e.error ? describeError(e.error) : e.message}`);
});
window.addEventListener('unhandledrejection', e => log(`Unhandled rejection: ${describeError(e.reason)}`));

const crash = restoreAfterCrash(loadPending() !== null);
const crashNotice = crash
  ? `The last session closed during "${crash.map(a => a.label).join(' + ')}", probably out of memory. ` +
    'It is in the report.'
  : '';
const crashedModels = new Set(crash?.map(a => a.model));

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
  // Talking requires WebGPU (ADR 0003), so the LLM stays off without it.
  const hasWebGpu = runtime.device === 'webgpu';
  button('load-llm').disabled ||= !hasWebGpu;
  $<HTMLSelectElement>('llm-model').disabled = !started || busy || !hasWebGpu;
  $<HTMLSelectElement>('stt-model').disabled = !started || busy;
  $<HTMLSelectElement>('vision-choice').disabled = !started || busy;
  const detectorPicker = $<HTMLSelectElement>('detector-choice');
  detectorPicker.disabled = !started || busy;
  for (const option of detectorPicker.options) {
    option.disabled = DETECTORS[option.value as DetectorChoice].needsWebGpu && runtime.device !== 'webgpu';
  }
  button('btn-start').disabled = busy;
  button('btn-camera').disabled = !started || busy || cameraOpen;
  $<HTMLSelectElement>('camera-res').disabled = !started || busy;
  button('btn-detect').disabled = !cameraOpen || !loaded.detector;
  button('btn-center').disabled = !cameraOpen;
  // Waking loads whatever it needs itself.
  button('btn-wake').disabled = busy || !cam.getSelected();
  button('btn-pending-continue').disabled = busy || !started;
  button('btn-pending-cancel').disabled = busy;
  button('btn-wake-text').disabled = busy || !loaded.llm || !$<HTMLInputElement>('text-label').value.trim();
  const canTalk = !busy && !!soul && !!loaded.llm;
  button('btn-talk').disabled = !canTalk || !loaded.stt;
  $<HTMLInputElement>('text-input').disabled = !canTalk;
  button('btn-send').disabled = !canTalk;
  button('btn-forget').disabled = busy || !soul;
  button('btn-report').disabled = !started;
  button('btn-clear-cache').disabled = busy;
}

// Runs a heavy step with actions disabled. The activity label is persisted while it runs, so if iOS
// kills the tab for lack of memory the next visit can say what was happening.
// Steps that mark themselves (model loads) pass null.
async function withBusy(activity: string | null, fn: () => Promise<void>): Promise<void> {
  busy = true;
  refreshButtons();
  const marker = activity === null ? null : beginActivity(activity);
  try {
    await fn();
  } catch (e) {
    log(`Error: ${(e as Error).message}`);
    console.error(e);
  } finally {
    if (marker !== null) endActivity(marker);
    busy = false;
    refreshButtons();
  }
}

// Device: the Start tap is also the gesture that unlocks speech on iOS.
button('btn-start').addEventListener('click', () =>
  withBusy('probe', async () => {
    voice.unlockSpeech();
    probe = await probeDevice();
    runtime.device = probe.webgpu ? 'webgpu' : 'wasm';
    runtime.f16 = probe.shaderF16;
    $('probe-out').textContent = [crashNotice, JSON.stringify(probe, null, 2)].filter(Boolean).join('\n\n');
    log(`Runtime: ${runtime.device}${runtime.f16 ? ' + fp16' : ''}`);
    if (!probe.webgpu) setStatus('llm', 'Needs WebGPU: this browser cannot wake things or talk', true);
    else if (!loaded.llm && !crashedModels.has('llm')) setStatus('llm', 'Not loaded');

    const models = await llm.listModels(runtime.f16);
    const picker = $<HTMLSelectElement>('llm-model');
    picker.replaceChildren(...models.map(m => new Option(`${m.id} (${m.vramMB} MB)`, m.id)));
    const preferred = models.find(m => llm.DEFAULT_MODEL.test(m.id)) ?? models[0];
    if (preferred) picker.value = preferred.id;

    setTimeout(() => log(`English system voices: ${voice.englishVoices().length}`), 1000);
    button('btn-start').textContent = 'Probe again';
    renderSoulList();
  }).then(() => continuePendingWake()),
);

// Models: one Load and one Free per model.
function selectedModel(key: ModelKey): string {
  if (key === 'llm') return $<HTMLSelectElement>('llm-model').value;
  if (key === 'stt') return $<HTMLSelectElement>('stt-model').value;
  return key === 'detector'
    ? `${DETECTORS[detectorChoice()].model} (${detectorChoice()})`
    : vlm.VISION_MODELS[visionChoice()];
}

const visionChoice = () => $<HTMLSelectElement>('vision-choice').value as vlm.VisionChoice;

const loaders: Record<ModelKey, () => Promise<string>> = {
  detector: async () => {
    await cam.loadDetector(detectorChoice());
    return selectedModel('detector');
  },
  vlm: async () => {
    await vlm.loadVLM(visionChoice());
    return selectedModel('vlm');
  },
  llm: async () => {
    // Talking requires WebGPU; see docs/decisions/0003-llm-requires-webgpu.md.
    if (runtime.device !== 'webgpu') throw new Error('Needs WebGPU');
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

// The tester picks the detector engine and where it runs (ADR 0010).
const detectorChoice = (): DetectorChoice => {
  const choice = $<HTMLSelectElement>('detector-choice').value as DetectorChoice;
  return DETECTORS[choice].needsWebGpu && runtime.device !== 'webgpu' ? 'mediapipe-cpu' : choice;
};
const deviceFor = (key: ModelKey): string =>
  key === 'detector' ? DETECTORS[detectorChoice()].label : runtime.device;

// Two-step mode wakes a thing across page reloads, so vision and the LLM never share one (ADR 0014).
const twoStep = () => $<HTMLInputElement>('two-step').checked;

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

  load.addEventListener('click', () => withBusy(null, () => loadModel(key)));
  free.addEventListener('click', () => withBusy(`free ${key}`, () => freeModel(key)));
}

// Loads one model, freeing its previous instance first so memory figures stay honest.
async function loadModel(key: ModelKey): Promise<void> {
  const marker = beginActivity(`load ${key} ${selectedModel(key)}`, key);
  if (key === 'llm') llmUsedThisPage = true;
  const device = deviceFor(key);
  setStatus(key, `Loading on ${device}…`);
  const start = performance.now();
  try {
    if (loaded[key] && key !== 'llm') await unloaders[key]();
    loaded[key] = await loaders[key]();
    const seconds = ((performance.now() - start) / 1000).toFixed(1);
    setStatus(key, `${loaded[key]!.split('/').pop()} on ${device}, ${seconds} s`);
    void showStorageUsage();
  } catch (e) {
    loaded[key] = null;
    setStatus(key, (e as Error).message, true);
    throw e;
  } finally {
    endActivity(marker);
    refreshButtons();
  }
}

async function freeModel(key: ModelKey): Promise<void> {
  if (key === 'detector') stopDetectionUi();
  await unloaders[key]();
  loaded[key] = null;
  setStatus(key, 'Freed');
  log(`Unloaded ${key}`);
  refreshButtons();
}

// Downloaded models: show what the origin stores and let the tester wipe it.
async function showStorageUsage(): Promise<void> {
  const mb = await storageUsageMB();
  $('st-cache').textContent = mb === null ? '' : `About ${mb} MB stored in this browser`;
}

button('btn-clear-cache').addEventListener('click', () => {
  const kept = MODEL_KEYS.some(k => loaded[k]) ? ' Loaded models keep working until you free them.' : '';
  if (!confirm(`Delete downloaded models? They will download again when loaded. Souls are kept.${kept}`))
    return;
  void withBusy('clear model caches', async () => {
    const before = await storageUsageMB();
    const deleted = await clearModelCaches();
    const after = await storageUsageMB();
    log(
      `Cleared ${deleted.length ? deleted.join(', ') : 'nothing'}; storage ${before ?? '?'} MB -> ${after ?? '?'} MB`,
    );
    $('st-cache').textContent = `Deleted. Now about ${after ?? '?'} MB`;
  });
});

// Camera and detection.
cam.initCamera($<HTMLVideoElement>('video'), $<HTMLCanvasElement>('overlay'), sel => {
  $('selected').textContent = sel
    ? `Selected: ${sel.label}${
        sel.label === cam.CENTRE_LABEL ? ' (centre of the image)' : ` (${Math.round(sel.score * 100)}%)`
      }.`
    : 'Tap a framed object, or use the centre if it is not recognized.';
  refreshButtons();
});

const cameraResolution = () => $<HTMLSelectElement>('camera-res').value as cam.CameraResolution;

button('btn-camera').addEventListener('click', () =>
  withBusy('open camera', async () => {
    await cam.startCamera(cameraResolution());
    cameraOpen = true;
    button('btn-camera').textContent = 'Camera open';
  }),
);

// Changing the resolution with the camera open reopens it at once.
$<HTMLSelectElement>('camera-res').addEventListener('change', () => {
  if (cameraOpen) void withBusy('reopen camera', () => cam.startCamera(cameraResolution()));
});

// Detection runs outside the busy flag, so it keeps its own crash marker while the loop is alive.
let detectMarker: number | null = null;

function endDetectMarker(): void {
  if (detectMarker !== null) endActivity(detectMarker);
  detectMarker = null;
}

function onDetectionStats(s: cam.DetectionStats | null): void {
  $('det-stats').textContent = s
    ? `${s.fps} fps, ${s.ms} ms per frame, ${s.count} objects`
    : 'Detector stopped';
  if (!s) {
    button('btn-detect').textContent = 'Detect';
    endDetectMarker();
  }
}

function startDetectionUi(): void {
  detectMarker ??= beginActivity(`detect with ${detectorChoice()}`, 'detector');
  try {
    cam.startDetection(onDetectionStats);
  } catch (e) {
    endDetectMarker();
    throw e;
  }
  button('btn-detect').textContent = 'Stop';
}

function stopDetectionUi(): void {
  cam.stopDetection();
  button('btn-detect').textContent = 'Detect';
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

// Waking a thing. In two-step mode (the default) this page crops the selection, describes it with vision
// if the LLM has not been used here, saves it as a pending wake and reloads; the fresh page finishes the
// wake after the Start tap (continuePendingWake). Otherwise everything runs here, as the spec described.
button('btn-wake').addEventListener('click', () =>
  withBusy('wake', async () => {
    const sel = cam.getSelected();
    const crop = cam.cropSelected();
    if (!sel || !crop) throw new Error('No camera image');
    // Detection is paused so the wake timings measure the models alone.
    const wasDetecting = cam.isDetecting();
    if (wasDetecting) stopDetectionUi();
    const thumbnail = crop.toDataURL('image/jpeg', 0.8);
    // The classifier is small enough to share a page load with the LLM, so it never needs the reloads.
    const reloads = twoStep() && visionChoice() === 'smolvlm';
    log(`Waking ${sel.label}${reloads ? ' (two steps)' : ''}…`);

    if (reloads) {
      let description: string | null = null;
      if (!llmUsedThisPage) {
        for (const key of ['detector', 'stt'] as const) if (loaded[key]) await freeModel(key);
        if (!loaded.vlm) await loadModel('vlm');
        description = (await timed('wake.describe', () => vlm.describe(crop))).text;
        log(`Vision: ${description}`);
      }
      reloadForNextStep({
        label: sel.label,
        thumbnail,
        description,
        llm: selectedModel('llm'),
        startedAt: Date.now(),
      });
      return;
    }

    const start = performance.now();
    try {
      // The LLM loads first, while memory is cleanest; it is by far the largest allocation.
      if (!loaded.llm) await loadModel('llm');
      if (!loaded.vlm) await loadModel('vlm');
      const { text: description, label } = await timed('wake.describe', () => vlm.describe(crop));
      log(`Vision: ${description}`);
      // "Use the centre" has no label of its own; the classifier's is better than "object".
      const soulLabel = sel.label === cam.CENTRE_LABEL && label ? label : sel.label;
      await createSoul(soulLabel, description, thumbnail);
      record('wake.total', performance.now() - start);
    } finally {
      if (wasDetecting && loaded.detector) startDetectionUi();
    }
    greet();
  }),
);

function reloadForNextStep(next: PendingWake): void {
  if (!savePending(next)) throw new Error('Could not save the wake to continue after reloading');
  log(`Reloading to ${pendingStep(next) === 'describe' ? 'describe' : 'create the soul of'} ${next.label}`);
  location.reload();
}

// Finishes a wake saved before a reload: describes the crop if needed (then reloads again), or creates
// the soul. Runs after the Start tap, which iOS needs before the greeting can be spoken.
async function continuePendingWake(): Promise<void> {
  const pending = loadPending();
  if (!pending) return;
  await withBusy('wake (continued)', async () => {
    if (pendingStep(pending) === 'describe') {
      const canvas = await canvasFromDataUrl(pending.thumbnail);
      if (!loaded.vlm) await loadModel('vlm');
      const description = (await timed('wake.describe', () => vlm.describe(canvas))).text;
      log(`Vision: ${description}`);
      reloadForNextStep({ ...pending, description });
      return;
    }
    const picker = $<HTMLSelectElement>('llm-model');
    if ([...picker.options].some(o => o.value === pending.llm)) picker.value = pending.llm;
    if (!loaded.llm) await loadModel('llm');
    await createSoul(pending.label, pending.description!, pending.thumbnail);
    // Includes the reloads and the tester's Start tap.
    record('wake.twoStepTotal', Date.now() - pending.startedAt);
    clearPending();
    renderPending();
    greet();
  });
}

async function canvasFromDataUrl(url: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas;
}

function renderPending(): void {
  const pending = loadPending();
  $('pending-wake').hidden = !pending;
  if (!pending) return;
  $<HTMLImageElement>('pending-img').src = pending.thumbnail;
  $('pending-text').textContent =
    pendingStep(pending) === 'describe'
      ? `Waking ${pending.label}. The page reloaded to free memory: tap Start to describe it.`
      : `Waking ${pending.label}. The page reloaded to free memory: tap Start to create its soul.`;
}

button('btn-pending-continue').addEventListener('click', () => void continuePendingWake());
button('btn-pending-cancel').addEventListener('click', () => {
  clearPending();
  renderPending();
  log('Pending wake cancelled');
});

// Waking without the camera: the tester types what the thing is and looks like. Only the LLM runs, and
// nothing else is loaded afterwards, so this measures LLM generation on its own (docs/models.md).
button('btn-wake-text').addEventListener('click', () =>
  withBusy('wake from text', async () => {
    const label = $<HTMLInputElement>('text-label').value.trim();
    const description = $<HTMLTextAreaElement>('text-description').value.trim() || label;
    log(`Waking ${label} from text…`);
    await createSoul(label, description, placeholderThumbnail(label));
    greet();
  }),
);

async function createSoul(label: string, description: string, thumbnail: string): Promise<void> {
  const profile = await timed('wake.createSoul', () => llm.createSoul(label, description));
  soul = {
    ...profile,
    id: crypto.randomUUID(),
    label,
    description,
    thumbnail,
    memory: '',
    history: [{ role: 'assistant', content: profile.greeting }],
    createdAt: Date.now(),
  };
  souls.saveSoul(soul);
}

function greet(): void {
  if (!soul) return;
  renderSoulList();
  $('transcript').replaceChildren();
  renderSoul(true);
  addBubble('soul', soul.greeting);
  voice.speak(soul.greeting, soul);
}

// A lamp-coloured disc with the thing's initial, for souls woken without a photo.
function placeholderThumbnail(label: string): string {
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#34305c';
  ctx.fillRect(0, 0, 192, 192);
  ctx.fillStyle = '#f5b942';
  ctx.font = '800 110px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((label[0] ?? '?').toUpperCase(), 96, 104);
  return c.toDataURL('image/png');
}

// Saved souls.
function renderSoulList(): void {
  const list = souls.listSouls();
  const picker = $<HTMLSelectElement>('soul-list');
  picker.replaceChildren(
    new Option(list.length ? 'Choose an awake soul' : 'No awake souls yet', ''),
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
  if (!soul || !confirm(`Forget ${soul.name}? This cannot be undone.`)) return;
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
  $('soul-traits').textContent = `${soul.traits.join(', ')}. "${soul.catchphrase}"`;
  $('soul-memory').textContent = soul.memory || 'Nothing yet.';
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
  talk.textContent = 'Listening… release to send';
  if (!pressed) void endTalk();
});

async function endTalk(): Promise<void> {
  pressed = false;
  if (!recording) return;
  recording = false;
  const releasedAt = performance.now();
  talk.classList.remove('recording');
  talk.textContent = 'Hold to talk';
  const blob = await voice.stopRecording();
  if (!blob) return;
  await withBusy('transcribe and reply', async () => {
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
  void withBusy('reply', () => reply(text, null));
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

if (crash) {
  $('probe-out').textContent = `${crashNotice} Tap Start to continue.`;
  for (const key of MODEL_KEYS) {
    if (crashedModels.has(key))
      setStatus(key, 'Last time the page closed while this model was running', true);
  }
}
$<HTMLInputElement>('two-step').addEventListener('change', refreshButtons);
$<HTMLInputElement>('text-label').addEventListener('input', refreshButtons);
renderSoulList();
renderPending();
refreshButtons();
void showStorageUsage();
log('Ready. Tap Start.');
