// Camera, live object detection, overlay drawing, selection and cropping.
import { createDetector, type DetectorBackend, type DetectorChoice } from './detectors';
import { log, record, timed } from './report';

export interface Box {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface Detection {
  label: string;
  score: number;
  box: Box;
}

export interface DetectionStats {
  fps: string;
  ms: number;
  count: number;
}

export const CENTRE_LABEL = 'object';
const TRACK_DISTANCE = 0.2;
const CROP_PADDING = 0.06;
const LAMP = '#f5b942';
const NIGHT = '#1c1936';
const PAPER = '#ece8fb';

let video: HTMLVideoElement;
let overlay: HTMLCanvasElement;
let octx: CanvasRenderingContext2D;
let onSelect: (sel: Detection | null) => void;
let detector: DetectorBackend | null = null;
let detectorChoice: DetectorChoice | null = null;
let running = false;
let boxes: Detection[] = [];
let selected: Detection | null = null;

// Pure selection helpers, exported for tests.
const area = (d: Detection) => (d.box.xmax - d.box.xmin) * (d.box.ymax - d.box.ymin);
const centre = (d: Detection) => [(d.box.xmin + d.box.xmax) / 2, (d.box.ymin + d.box.ymax) / 2] as const;
const distance = (a: Detection, b: Detection) => {
  const [ax, ay] = centre(a);
  const [bx, by] = centre(b);
  return Math.hypot(ax - bx, ay - by);
};

// The smallest box containing the point, so nested objects stay selectable.
export function pickAt(all: Detection[], x: number, y: number): Detection | null {
  const hits = all.filter(d => x >= d.box.xmin && x <= d.box.xmax && y >= d.box.ymin && y <= d.box.ymax);
  return hits.sort((a, b) => area(a) - area(b))[0] ?? null;
}

// Follows the selection to the nearest box with the same label, or keeps the last known box.
export function track(sel: Detection | null, all: Detection[]): Detection | null {
  if (!sel || sel.label === CENTRE_LABEL) return sel;
  const nearest = all
    .filter(d => d.label === sel.label)
    .sort((a, b) => distance(a, sel) - distance(b, sel))[0];
  return nearest && distance(nearest, sel) < TRACK_DISTANCE ? nearest : sel;
}

export function initCamera(
  videoEl: HTMLVideoElement,
  overlayEl: HTMLCanvasElement,
  selectCallback: (sel: Detection | null) => void,
): void {
  video = videoEl;
  overlay = overlayEl;
  octx = overlay.getContext('2d')!;
  onSelect = selectCallback;
  overlay.addEventListener('click', e => {
    const r = overlay.getBoundingClientRect();
    selected = pickAt(boxes, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    draw();
    onSelect(selected);
  });
}

// Requested capture sizes, as landscape width x height (phones rotate them to portrait). Lower ones test
// whether the camera's own memory matters on the iPhone (ADR 0015).
export const CAMERA_RESOLUTIONS = {
  '720p': { width: 1280, height: 720 },
  '480p': { width: 640, height: 480 },
  '360p': { width: 640, height: 360 },
} as const;
export type CameraResolution = keyof typeof CAMERA_RESOLUTIONS;

let listening = false;

// Opens the rear camera, or reopens it at a new resolution, stopping the previous stream first.
export async function startCamera(resolution: CameraResolution = '720p'): Promise<void> {
  const { width, height } = CAMERA_RESOLUTIONS[resolution];
  (video.srcObject as MediaStream | null)?.getTracks().forEach(t => t.stop());
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: width }, height: { ideal: height } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  resize();
  if (!listening) {
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe(video);
    listening = true;
  }
  log(`Camera ${video.videoWidth}x${video.videoHeight} (asked for ${resolution})`);
}

export const isCameraOpen = () => !!video?.videoWidth;

function resize(): void {
  overlay.width = Math.round(video.clientWidth * devicePixelRatio);
  overlay.height = Math.round(video.clientHeight * devicePixelRatio);
  draw();
}

// The tester picks the detector and where it runs (ADR 0010).
export async function loadDetector(choice: DetectorChoice): Promise<void> {
  detector = await timed(`load.detector.${choice}`, () => createDetector(choice));
  detectorChoice = choice;
}

export async function unloadDetector(): Promise<void> {
  running = false;
  await detector?.dispose();
  detector = null;
  detectorChoice = null;
  boxes = [];
  draw();
}

export const isDetecting = () => running;

export function startDetection(onStats: (s: DetectionStats | null) => void): void {
  if (!detector) throw new Error('Load the detector first');
  if (!isCameraOpen()) throw new Error('Open the camera first');
  running = true;
  void loop(onStats);
}

export function stopDetection(): void {
  running = false;
}

async function loop(onStats: (s: DetectionStats | null) => void): Promise<void> {
  let frames = 0;
  let totalMs = 0;
  let windowStart = performance.now();
  const metric = `detect.frame.${detectorChoice}`;
  while (running && detector) {
    const t = performance.now();
    try {
      boxes = await detector.detect(video);
    } catch (e) {
      log(`Detection error: ${(e as Error).message}`);
      break;
    }
    const next = track(selected, boxes);
    if (next !== selected) {
      selected = next;
      onSelect(selected);
    }
    draw();
    const ms = performance.now() - t;
    record(metric, ms, true);
    frames++;
    totalMs += ms;
    const elapsed = performance.now() - windowStart;
    if (elapsed > 1000) {
      onStats({
        fps: ((frames * 1000) / elapsed).toFixed(1),
        ms: Math.round(totalMs / frames),
        count: boxes.length,
      });
      frames = 0;
      totalMs = 0;
      windowStart = performance.now();
    }
    await new Promise(requestAnimationFrame);
  }
  running = false;
  onStats(null);
}

export function selectCentre(): void {
  selected = { label: CENTRE_LABEL, score: 1, box: { xmin: 0.25, ymin: 0.2, xmax: 0.75, ymax: 0.8 } };
  draw();
  onSelect(selected);
}

function draw(): void {
  if (!octx) return;
  const w = overlay.width;
  const h = overlay.height;
  const px = devicePixelRatio;
  octx.clearRect(0, 0, w, h);
  octx.font = `600 ${14 * px}px system-ui, sans-serif`;
  const all = selected && !boxes.includes(selected) ? [...boxes, selected] : boxes;
  for (const d of all) {
    const isSel = d === selected;
    const x = d.box.xmin * w;
    const y = d.box.ymin * h;
    octx.save();
    octx.lineWidth = (isSel ? 4 : 2) * px;
    octx.strokeStyle = isSel ? LAMP : 'rgba(236,232,251,.8)';
    if (isSel) {
      octx.shadowColor = LAMP;
      octx.shadowBlur = 18 * px;
    }
    octx.beginPath();
    octx.roundRect(x, y, (d.box.xmax - d.box.xmin) * w, (d.box.ymax - d.box.ymin) * h, 12 * px);
    octx.stroke();
    octx.restore();
    const text = d.label === CENTRE_LABEL ? d.label : `${d.label} ${Math.round(d.score * 100)}%`;
    const tw = octx.measureText(text).width + 12 * px;
    const ty = Math.max(0, y - 22 * px);
    octx.fillStyle = isSel ? LAMP : 'rgba(28,25,54,.85)';
    octx.beginPath();
    octx.roundRect(x, ty, tw, 22 * px, 6 * px);
    octx.fill();
    octx.fillStyle = isSel ? NIGHT : PAPER;
    octx.fillText(text, x + 6 * px, ty + 16 * px);
  }
}

// Crops the selected box from the full-resolution frame with padding, longest side at most maxSide.
export function cropSelected(maxSide = 384): HTMLCanvasElement | null {
  if (!selected || !isCameraOpen()) return null;
  const { xmin, ymin, xmax, ymax } = selected.box;
  const W = video.videoWidth;
  const H = video.videoHeight;
  const x0 = Math.max(0, (xmin - CROP_PADDING) * W);
  const y0 = Math.max(0, (ymin - CROP_PADDING) * H);
  const x1 = Math.min(W, (xmax + CROP_PADDING) * W);
  const y1 = Math.min(H, (ymax + CROP_PADDING) * H);
  const w = x1 - x0;
  const h = y1 - y0;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d')!.drawImage(video, x0, y0, w, h, 0, 0, c.width, c.height);
  return c;
}

export const getSelected = () => selected;
