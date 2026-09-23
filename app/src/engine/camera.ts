// The rear camera and the square in the middle of the frame, where the thing to wake is.
export const CROP_SIDE = 384;
export const THUMB_SIDE = 256;
// The share of the shorter side the viewfinder's square covers; the Wake screen draws the same square.
export const FRAME_SHARE = 0.72;

export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return stream;
}

export function closeCamera(stream: MediaStream | null, video?: HTMLVideoElement | null): void {
  stream?.getTracks().forEach(t => t.stop());
  if (video) video.srcObject = null;
}

// The centred square covering FRAME_SHARE of the shorter side, in source pixels.
export function centreSquare(width: number, height: number, share = FRAME_SHARE) {
  const side = Math.round(Math.min(width, height) * share);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}

export interface Square {
  x: number;
  y: number;
  side: number;
}

// Maps a square drawn over a video shown with object-fit: cover back to the video's own pixels, so the
// crop is exactly what the viewfinder framed. `frame` is relative to the video element's box.
export function coveredSquare(
  source: { width: number; height: number },
  box: { width: number; height: number },
  frame: Square,
): Square {
  const scale = Math.max(box.width / source.width, box.height / source.height);
  const offsetX = (box.width - source.width * scale) / 2;
  const offsetY = (box.height - source.height * scale) / 2;
  const side = Math.min(frame.side / scale, source.width, source.height);
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max - side);
  return {
    x: Math.round(clamp((frame.x - offsetX) / scale, source.width)),
    y: Math.round(clamp((frame.y - offsetY) / scale, source.height)),
    side: Math.round(side),
  };
}

// The square under `frameEl` in the video's pixels, or the centred square when the layout is unknown.
export function framedSquare(video: HTMLVideoElement, frameEl: Element | null): Square {
  const source = { width: video.videoWidth, height: video.videoHeight };
  const box = video.getBoundingClientRect();
  const frame = frameEl?.getBoundingClientRect();
  if (!frame || !box.width || !box.height) return centreSquare(source.width, source.height);
  return coveredSquare(source, box, { x: frame.left - box.left, y: frame.top - box.top, side: frame.width });
}

export function cropCentre(
  source: HTMLVideoElement | HTMLCanvasElement,
  side = CROP_SIDE,
  square?: Square,
): HTMLCanvasElement {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  const sq = square ?? centreSquare(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  canvas
    .getContext('2d', { willReadFrequently: true })!
    .drawImage(source, sq.x, sq.y, sq.side, sq.side, 0, 0, side, side);
  return canvas;
}

export function thumbnailOf(canvas: HTMLCanvasElement, side = THUMB_SIDE): string {
  const small = document.createElement('canvas');
  small.width = small.height = side;
  small.getContext('2d')!.drawImage(canvas, 0, 0, side, side);
  return small.toDataURL('image/jpeg', 0.8);
}
