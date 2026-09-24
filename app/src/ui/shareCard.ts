// A soul's card, drawn on a canvas and shared as a PNG: its photo, name, title, catchphrase and traits.
// Portrait 4:5, the size social feeds show best.
import type { Soul } from '../store/souls';
import { t } from '../i18n';
import { tintOf } from './Portrait';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
const SERIF = '"Fraunces Variable", Georgia, serif';
const SANS = '"Figtree Variable", system-ui, sans-serif';
export const APP_URL = 'ezar.github.io/hearthwake';

// Greedy word wrap; `measure` returns a string's width.
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function drawCard(soul: Soul): Promise<Blob> {
  await Promise.all([
    document.fonts?.load(`600 100px ${SERIF}`),
    document.fonts?.load(`500 40px ${SANS}`),
  ]).catch(() => undefined);
  const { tint, bg } = tintOf(soul);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  const cx = CARD_WIDTH / 2;
  ctx.fillStyle = '#1a1411';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Portrait.
  const r = 200;
  const cy = 330;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();
  const photo = soul.thumbnail ? await loadImage(soul.thumbnail) : null;
  if (photo) ctx.drawImage(photo, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = tint;
    ctx.font = `600 180px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((soul.name[0] ?? '?').toUpperCase(), cx, cy + 8);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 10;
  ctx.strokeStyle = tint;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = cy + r + 150;
  ctx.fillStyle = '#f3e9da';
  ctx.font = `600 104px ${SERIF}`;
  ctx.fillText(soul.name, cx, y, CARD_WIDTH - 120);

  ctx.fillStyle = '#bfae99';
  ctx.font = `500 42px ${SANS}`;
  for (const line of wrapLines(soul.title, CARD_WIDTH - 200, s => ctx.measureText(s).width)) {
    y += 62;
    ctx.fillText(line, cx, y);
  }

  if (soul.catchphrase) {
    ctx.fillStyle = tint;
    ctx.font = `italic 500 56px ${SERIF}`;
    for (const line of wrapLines(`“${soul.catchphrase}”`, CARD_WIDTH - 200, s => ctx.measureText(s).width)) {
      y += 90;
      ctx.fillText(line, cx, y);
    }
  }

  // Traits as pills, centred on one row.
  if (soul.traits.length) {
    ctx.font = `500 36px ${SANS}`;
    const pad = 30;
    const gap = 16;
    const widths = soul.traits.map(t => ctx.measureText(t).width + pad * 2);
    let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)) / 2;
    y += 70;
    soul.traits.forEach((t, i) => {
      const w = widths[i]!;
      ctx.fillStyle = '#30251e';
      ctx.beginPath();
      ctx.roundRect(x, y, w, 68, 34);
      ctx.fill();
      ctx.fillStyle = '#f3e9da';
      ctx.fillText(t, x + w / 2, y + 46);
      x += w + gap;
    });
  }

  // Footer.
  ctx.fillStyle = '#f08a4b';
  ctx.font = `600 40px ${SERIF}`;
  ctx.fillText(t('Woke up with Hearthwake'), cx, CARD_HEIGHT - 110);
  ctx.fillStyle = '#bfae99';
  ctx.font = `500 32px ${SANS}`;
  ctx.fillText(APP_URL, cx, CARD_HEIGHT - 60);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not draw the card'))), 'image/png'),
  );
}

// Shares through the system sheet where files can be shared (phones), else downloads the PNG.
export async function shareSoul(soul: Soul): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await drawCard(soul);
  const file = new File([blob], `${soul.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'soul'}.png`, {
    type: 'image/png',
  });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: soul.name,
        text: `${soul.name}, ${soul.title}. https://${APP_URL}/`,
      });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
