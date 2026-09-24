// The mock engine has no camera: a painted frame stands in, so the flow can be tested headless.
let frame: HTMLCanvasElement | null = null;
export function mockFrame(): HTMLCanvasElement {
  if (frame) return frame;
  frame = document.createElement('canvas');
  frame.width = 720;
  frame.height = 1280;
  const ctx = frame.getContext('2d')!;
  ctx.fillStyle = '#6f6a66';
  ctx.fillRect(0, 0, 720, 1280);
  ctx.fillStyle = '#c98a4f';
  ctx.fillRect(160, 300, 400, 680);
  ctx.fillStyle = '#d9d4cf';
  ctx.fillRect(360, 300, 200, 680);
  return frame;
}

export function mockCamera(video: HTMLVideoElement): void {
  const canvas = mockFrame();
  const stream = (
    canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }
  ).captureStream?.(5);
  if (stream) {
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }
}
