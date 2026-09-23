// A stand-in engine for development and end-to-end tests on machines without WebGPU: open the app with
// ?mock and the LLM and classifier answer instantly with canned text. Never used unless asked for.
import type { LlmBackend } from './llm';
import type { VisionBackend } from './vision';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const SOUL = {
  name: 'Flibber',
  title: 'The Sliding Door of Destiny',
  archetype: 'Timekeeper',
  traits: ['timely', 'whimsical', 'optimistic'],
  style: 'Speaks in quick, cheerful bursts.',
  catchphrase: 'Aha!',
  secret: 'It squeaks on purpose when it is happy.',
  pitch: 'high',
  rate: 'fast',
  greeting: "Hello, I'm Flibber! I look like a grey sliding door, but I've got so much to offer!",
};

const REPLIES = [
  'Aha! Every time I slide open, a little adventure begins.',
  'I keep time for the hallway. Nobody gets past me without a hello!',
  'Oh, I remember that! Doors never forget a good story.',
];

export function mockLlm(): LlmBackend {
  let turn = 0;
  return {
    async load(onProgress) {
      for (let i = 1; i <= 10; i++) {
        await wait(60);
        onProgress(i / 10, `Fetching the model ${i * 10}%`);
      }
    },
    async complete({ grammar }) {
      await wait(400);
      if (grammar) return { text: JSON.stringify(SOUL), finishReason: 'stop', tokens: 120 };
      return { text: 'The player told Flibber about their day.', finishReason: 'stop', tokens: 12 };
    },
    async *stream() {
      const text = REPLIES[turn++ % REPLIES.length]!;
      for (const word of text.split(/(?<= )/)) {
        await wait(40);
        yield word;
      }
    },
  };
}

export function mockVision(): VisionBackend {
  return {
    async load() {
      await wait(100);
    },
    classify: () => [
      { label: 'sliding door', score: 0.49 },
      { label: 'wardrobe', score: 0.1 },
    ],
  };
}

export const mockRequested = () =>
  new URLSearchParams(location.search).has('mock') || sessionStorage.getItem('hearthwake.mock') === '1';
