// UI wiring for the Hearthwake M0 feasibility spike.
import { runtime } from './runtime.js';
import { initLog, log, record, timed, buildReport } from './report.js';
import { probeDevice } from './probe.js';
import * as cam from './camera.js';
import * as vlm from './vlm.js';
import * as llm from './llm.js';
import * as voice from './voice.js';
import * as souls from './souls.js';

const $ = id => document.getElementById(id);
let probe = null;
let soul = null;
let busy = false;
const loaded = { detector: false, vlm: false, llm: null, stt: null };

initLog($('log'));

function setStatus(key, text, isError = false) {
  const el = $(`st-${key}`);
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function refreshButtons() {
  const started = !!probe;
  for (const key of ['detector', 'vlm', 'llm', 'stt']) {
    const isLoaded = !!loaded[key];
    document.querySelector(`[data-load="${key}"]`).disabled = !started || busy;
    document.querySelector(`[data-free="${key}"]`).disabled = !isLoaded || busy;
  }
  $('llm-model').disabled = !started || busy;
  $('stt-model').disabled = !started || busy;
  $('btn-camera').disabled = !started;
  $('btn-detect').disabled = !started || !loaded.detector;
  $('btn-center').disabled = !started;
  $('btn-wake').disabled = busy || !cam.getSelected() || !loaded.vlm || !loaded.llm;
  const canTalk = !!soul && !!loaded.llm;
  $('btn-talk').disabled = busy || !canTalk || !loaded.stt;
  $('text-input').disabled = busy || !canTalk;
  $('btn-send').disabled = busy || !canTalk;
  $('btn-forget').disabled = !soul;
  $('btn-report').disabled = !started;
}

async function withBusy(fn) {
  busy = true;
  refreshButtons();
  try {
    await fn();
  } catch (e) {
    log(`Error: ${e.message}`);
    console.error(e);
  } finally {
    busy = false;
    refreshButtons();
  }
}

// Start: unlock speech, probe the device, fill model pickers.
$('btn-start').addEventListener('click', () => withBusy(async () => {
  voice.unlockSpeech();
  probe = await probeDevice();
  runtime.device = probe.webgpu ? 'webgpu' : 'wasm';
  runtime.f16 = probe.shaderF16;
  $('probe-out').textContent = JSON.stringify(probe, null, 2);
  log(`Runtime: ${runtime.device}${runtime.f16 ? ' + fp16' : ''}`);

  const models = llm.listModels(runtime.f16);
  $('llm-model').innerHTML = models.map(m => `<option value="${m.id}">${m.id} (${m.vramMB} MB)</option>`).join('');
  const preferred = models.find(m => /Qwen2\.5-1\.5B/.test(m.id)) ?? models[0];
  if (preferred) $('llm-model').value = preferred.id;

  setTimeout(() => log(`Spanish system voices: ${voice.spanishVoices().length}`), 800);
  $('btn-start').textContent = 'Reanalizar';
  renderSoulList();
}));

// Model load and unload buttons.
const loaders = {
  detector: async () => { await cam.loadDetector(); return 'Listo'; },
  vlm: async () => { await vlm.loadVLM(); return 'Listo'; },
  llm: async () => {
    const id = $('llm-model').value;
    await llm.loadLLM(id, text => setStatus('llm', text));
    return id;
  },
  stt: async () => {
    const id = $('stt-model').value;
    await voice.loadSTT(id);
    return id.split('/').pop();
  },
};
const unloaders = {
  detector: () => cam.unloadDetector(),
  vlm: () => vlm.unloadVLM(),
  llm: () => llm.unloadLLM(),
  stt: () => voice.unloadSTT(),
};

document.querySelectorAll('[data-load]').forEach(btn => btn.addEventListener('click', () => withBusy(async () => {
  const key = btn.dataset.load;
  setStatus(key, `Cargando en ${runtime.device}…`);
  try {
    const result = await loaders[key]();
    loaded[key] = result;
    setStatus(key, `${result} (${runtime.device})`);
  } catch (e) {
    loaded[key] = false;
    setStatus(key, e.message, true);
    throw e;
  }
})));

document.querySelectorAll('[data-free]').forEach(btn => btn.addEventListener('click', () => withBusy(async () => {
  const key = btn.dataset.free;
  await unloaders[key]();
  loaded[key] = key === 'llm' || key === 'stt' ? null : false;
  setStatus(key, 'Liberado');
  log(`Unloaded ${key}`);
})));

// Camera and detection.
cam.initCamera($('video'), $('overlay'), sel => {
  $('selected').textContent = sel
    ? `Seleccionado: ${sel.label}${sel.label === 'objeto' ? ' (centro de la imagen)' : ` (${Math.round(sel.score * 100)}%)`}.`
    : 'Toca un objeto enmarcado, o usa el centro si no lo reconoce.';
  refreshButtons();
});

$('btn-camera').addEventListener('click', () => withBusy(async () => {
  await cam.startCamera();
  $('btn-camera').textContent = 'Cámara abierta';
}));

$('btn-detect').addEventListener('click', () => {
  if (cam.isDetecting()) {
    cam.stopDetection();
    $('btn-detect').textContent = 'Detectar';
    return;
  }
  try {
    cam.startDetection(s => {
      $('det-stats').textContent = s ? `${s.fps} fps, ${s.ms} ms por fotograma, ${s.count} objetos` : 'Detector parado';
    });
    $('btn-detect').textContent = 'Parar';
  } catch (e) {
    log(e.message);
  }
});

$('btn-center').addEventListener('click', () => cam.selectCentre());

// Waking a thing: crop, describe, create the soul, greet.
$('btn-wake').addEventListener('click', () => withBusy(async () => {
  const sel = cam.getSelected();
  const crop = cam.cropSelected();
  if (!crop) throw new Error('No hay imagen de la cámara');
  const start = performance.now();
  log(`Waking ${sel.label}…`);
  const description = await timed('wake.describe', () => vlm.describe(crop));
  log(`VLM: ${description}`);
  const created = await timed('wake.createSoul', () => llm.createSoul(sel.label, description));
  soul = {
    ...created,
    id: crypto.randomUUID(),
    label: sel.label,
    description,
    thumbnail: crop.toDataURL('image/jpeg', 0.7),
    memory: '',
    history: [{ role: 'assistant', content: created.greeting }],
    createdAt: Date.now(),
  };
  souls.saveSoul(soul);
  record('wake.total', performance.now() - start);
  renderSoulList();
  renderSoul();
  addBubble('soul', soul.greeting);
  voice.speak(soul.greeting, soul);
}));

// Saved souls.
function renderSoulList() {
  const list = souls.listSouls();
  $('soul-list').innerHTML = '<option value="">Elige un alma despierta</option>' +
    list.map(s => `<option value="${s.id}">${escapeHtml(s.name)}, ${escapeHtml(s.label)}</option>`).join('');
  if (soul) $('soul-list').value = soul.id;
}

$('soul-list').addEventListener('change', e => {
  soul = e.target.value ? souls.getSoul(e.target.value) : null;
  $('transcript').innerHTML = '';
  if (soul) soul.history.forEach(m => addBubble(m.role === 'user' ? 'user' : 'soul', m.content));
  renderSoul();
  refreshButtons();
});

$('btn-forget').addEventListener('click', () => {
  if (!soul || !confirm(`¿Olvidar a ${soul.name}?`)) return;
  souls.forgetSoul(soul.id);
  soul = null;
  $('transcript').innerHTML = '';
  renderSoul();
  renderSoulList();
  refreshButtons();
});

function renderSoul() {
  $('soul-card').hidden = !soul;
  if (!soul) return;
  $('soul-img').src = soul.thumbnail;
  $('soul-img').alt = soul.label;
  $('soul-name').textContent = soul.name;
  $('soul-title').textContent = `${soul.title}. ${soul.archetype}.`;
  $('soul-traits').textContent = `${soul.traits.join(', ')}. "${soul.catchphrase}"`;
  $('soul-memory').textContent = soul.memory || 'Todavía nada.';
}

function addBubble(kind, text) {
  const el = document.createElement('div');
  el.className = `bubble ${kind}`;
  el.textContent = text;
  $('transcript').append(el);
  $('transcript').scrollTop = $('transcript').scrollHeight;
  return el;
}

// Talking: push-to-talk, transcription, streamed reply with sentence-level speech.
async function reply(text, releasedAt) {
  addBubble('user', text);
  const bubble = addBubble('soul', '');
  const splitter = voice.sentenceSplitter();
  const start = performance.now();
  let spoken = false;
  const onStart = () => {
    if (spoken) return;
    spoken = true;
    record('talk.firstAudioFromText', performance.now() - start);
    if (releasedAt) record('talk.firstAudioFromRelease', performance.now() - releasedAt);
  };
  const full = await llm.chat(soul, text, delta => {
    bubble.textContent += delta;
    splitter.push(delta).forEach(s => voice.speak(s, soul, onStart));
  });
  splitter.flush().forEach(s => voice.speak(s, soul, onStart));
  soul.history.push({ role: 'user', content: text }, { role: 'assistant', content: full });
  if (soul.history.length > 16) {
    soul = await timed('memory.compact', () => llm.compactMemory(soul));
    renderSoul();
  }
  souls.saveSoul(soul);
}

const talk = $('btn-talk');
let recording = false;
talk.addEventListener('contextmenu', e => e.preventDefault());
talk.addEventListener('pointerdown', async e => {
  if (talk.disabled || recording) return;
  e.preventDefault();
  talk.setPointerCapture?.(e.pointerId);
  voice.stopSpeaking();
  try {
    await voice.startRecording();
    recording = true;
    talk.classList.add('recording');
    talk.textContent = 'Escuchando… suelta para enviar';
  } catch (err) {
    log(`Mic error: ${err.message}`);
  }
});

async function endTalk() {
  if (!recording) return;
  recording = false;
  const releasedAt = performance.now();
  talk.classList.remove('recording');
  talk.textContent = 'Mantén pulsado para hablar';
  const blob = await voice.stopRecording();
  if (!blob) return;
  await withBusy(async () => {
    const text = await timed('stt.transcribe', () => voice.transcribe(blob));
    if (!text) { log('No speech detected'); return; }
    await reply(text, releasedAt);
  });
}
talk.addEventListener('pointerup', endTalk);
talk.addEventListener('pointercancel', endTalk);

$('text-form').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('text-input').value.trim();
  if (!text) return;
  $('text-input').value = '';
  voice.stopSpeaking();
  withBusy(() => reply(text, null));
});

// Report.
$('btn-report').addEventListener('click', async () => {
  const report = buildReport(probe, {
    llm: loaded.llm, stt: loaded.stt, detector: loaded.detector ? 'Xenova/yolos-tiny' : null,
    vlm: loaded.vlm ? 'HuggingFaceTB/SmolVLM-256M-Instruct' : null,
  });
  const json = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    log('Report copied to clipboard');
  } catch {
    $('log').textContent = json;
    log('Clipboard unavailable, report shown above');
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

window.addEventListener('error', e => log(`Unhandled: ${e.message}`));
window.addEventListener('unhandledrejection', e => log(`Unhandled: ${e.reason?.message ?? e.reason}`));
refreshButtons();
log('Ready. Tap Iniciar.');
