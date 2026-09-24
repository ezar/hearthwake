// Reading text from a photo (labels, menus) on the device with Tesseract (WASM). Its worker, core and English
// and Spanish language data come from its CDN on first use and are cached by the browser (ADR 0024). The worker
// is shut down after each read, so its memory is not held beside the LLM.
import { engineState } from './engine';
import { log, timed } from './metrics';

export const MOCK_LABEL_TEXT =
  'INGREDIENTS: wheat flour, sugar, cocoa butter, whole milk powder, hazelnuts (5%), emulsifier: soy lecithin.';

export async function readText(
  image: HTMLCanvasElement,
  onProgress: (fraction: number) => void,
): Promise<string> {
  if (engineState().mock) {
    onProgress(1);
    return MOCK_LABEL_TEXT;
  }
  return timed('ocr.read', async () => {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(['eng', 'spa'], 1, {
      logger: m => {
        if (m.status === 'recognizing text') onProgress(m.progress);
      },
    });
    try {
      const { data } = await worker.recognize(image);
      log(`OCR: ${data.text.length} characters, confidence ${Math.round(data.confidence)}`);
      return cleanOcr(data.text);
    } finally {
      await worker.terminate();
    }
  });
}

// OCR output keeps line breaks from the print and stray symbols; join it into readable text.
export function cleanOcr(text: string): string {
  return text
    .replace(/-\n(?=\p{Ll})/gu, '')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .filter(l => /\p{L}{2,}/u.test(l))
    .join('\n')
    .trim();
}
