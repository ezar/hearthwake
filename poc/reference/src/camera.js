// Camera, live object detection, overlay drawing and cropping of the selected object.
import { TRANSFORMERS, runtime } from './runtime.js';
import { log, record, timed } from './report.js';

const { pipeline, RawImage } = await import(TRANSFORMERS);

const DETECT_WIDTH = 320;
const frame = document.createElement('canvas');
const fctx = frame.getContext('2d', { willReadFrequently: true });

let video, overlay, octx, onSelect;
let detector = null;
let running = false;
let boxes = [];
let selected = null;

const area = b => (b.box.xmax - b.box.xmin) * (b.box.ymax - b.box.ymin);
const centre = b => [(b.box.xmin + b.box.xmax) / 2, (b.box.ymin + b.box.ymax) / 2];
const dist = (a, b) => Math.hypot(centre(a)[0] - centre(b)[0], centre(a)[1] - centre(b)[1]);

export function initCamera(videoEl, overlayEl, selectCallback) {
  video = videoEl;
  overlay = overlayEl;
  octx = overlay.getContext('2d');
  onSelect = selectCallback;
  overlay.addEventListener('click', e => {
    const r = overlay.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const hits = boxes.filter(b => x >= b.box.xmin && x <= b.box.xmax && y >= b.box.ymin && y <= b.box.ymax);
    selected = hits.sort((a, b) => area(a) - area(b))[0] ?? null;
    draw();
    onSelect(selected);
  });
}

export async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  resize();
  window.addEventListener('resize', resize);
  log(`Camera ${video.videoWidth}x${video.videoHeight}`);
}

function resize() {
  overlay.width = Math.round(video.clientWidth * devicePixelRatio);
  overlay.height = Math.round(video.clientHeight * devicePixelRatio);
  draw();
}

export async function loadDetector() {
  const webgpu = runtime.device === 'webgpu';
  detector = await timed('load.detector', () =>
    pipeline('object-detection', 'Xenova/yolos-tiny', { device: runtime.device, dtype: webgpu ? 'fp32' : 'q8' }));
}

export async function unloadDetector() {
  running = false;
  await detector?.dispose?.();
  detector = null;
}

export const isDetecting = () => running;

export function startDetection(onStats) {
  if (!detector) throw new Error('Carga el detector primero');
  if (!video.videoWidth) throw new Error('Abre la cámara primero');
  running = true;
  loop(onStats);
}

export function stopDetection() { running = false; }

async function loop(onStats) {
  let frames = 0;
  let totalMs = 0;
  let windowStart = performance.now();
  while (running) {
    const t = performance.now();
    frame.width = DETECT_WIDTH;
    frame.height = Math.round(DETECT_WIDTH * video.videoHeight / video.videoWidth);
    fctx.drawImage(video, 0, 0, frame.width, frame.height);
    const { data } = fctx.getImageData(0, 0, frame.width, frame.height);
    const image = new RawImage(data, frame.width, frame.height, 4).rgb();
    try {
      boxes = await detector(image, { threshold: 0.6, percentage: true });
    } catch (e) {
      log(`Detection error: ${e.message}`);
      running = false;
      break;
    }
    // Keep the selection attached to the nearest box with the same label.
    if (selected && selected.label !== 'objeto') {
      const same = boxes.filter(b => b.label === selected.label).sort((a, b) => dist(a, selected) - dist(b, selected))[0];
      if (same && dist(same, selected) < 0.2) selected = same;
    }
    draw();
    const ms = performance.now() - t;
    record('detect.frame', ms, true);
    frames++;
    totalMs += ms;
    const elapsed = performance.now() - windowStart;
    if (elapsed > 1000) {
      onStats({ fps: (frames * 1000 / elapsed).toFixed(1), ms: Math.round(totalMs / frames), count: boxes.length });
      frames = 0; totalMs = 0; windowStart = performance.now();
    }
    await new Promise(requestAnimationFrame);
  }
  onStats(null);
}

export function selectCentre() {
  selected = { label: 'objeto', score: 1, box: { xmin: 0.25, ymin: 0.2, xmax: 0.75, ymax: 0.8 } };
  draw();
  onSelect(selected);
}

function draw() {
  if (!octx) return;
  const w = overlay.width;
  const h = overlay.height;
  const px = devicePixelRatio;
  octx.clearRect(0, 0, w, h);
  octx.font = `600 ${14 * px}px system-ui, sans-serif`;
  const all = selected && !boxes.includes(selected) ? [...boxes, selected] : boxes;
  for (const b of all) {
    const isSel = b === selected;
    const x = b.box.xmin * w, y = b.box.ymin * h;
    const bw = (b.box.xmax - b.box.xmin) * w, bh = (b.box.ymax - b.box.ymin) * h;
    octx.save();
    octx.lineWidth = (isSel ? 4 : 2) * px;
    octx.strokeStyle = isSel ? '#f5b942' : 'rgba(236,232,251,.8)';
    if (isSel) { octx.shadowColor = '#f5b942'; octx.shadowBlur = 18 * px; }
    octx.beginPath();
    octx.roundRect(x, y, bw, bh, 12 * px);
    octx.stroke();
    octx.restore();
    const text = `${b.label} ${Math.round(b.score * 100)}%`;
    const tw = octx.measureText(text).width + 12 * px;
    octx.fillStyle = isSel ? '#f5b942' : 'rgba(28,25,54,.85)';
    octx.fillRect(x, Math.max(0, y - 22 * px), tw, 22 * px);
    octx.fillStyle = isSel ? '#1c1936' : '#ece8fb';
    octx.fillText(text, x + 6 * px, Math.max(16 * px, y - 6 * px));
  }
}

// Crops the selected box from the full-resolution video frame.
export function cropSelected(maxSide = 384) {
  if (!selected || !video.videoWidth) return null;
  const { xmin, ymin, xmax, ymax } = selected.box;
  const W = video.videoWidth, H = video.videoHeight, pad = 0.06;
  const x0 = Math.max(0, (xmin - pad) * W), y0 = Math.max(0, (ymin - pad) * H);
  const x1 = Math.min(W, (xmax + pad) * W), y1 = Math.min(H, (ymax + pad) * H);
  const w = x1 - x0, h = y1 - y0;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  c.getContext('2d').drawImage(video, x0, y0, w, h, 0, 0, c.width, c.height);
  return c;
}

export const getSelected = () => selected;
