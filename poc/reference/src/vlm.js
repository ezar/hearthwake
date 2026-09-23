// Small vision-language model that describes the selected object.
import { TRANSFORMERS, runtime } from './runtime.js';
import { timed } from './report.js';

const { AutoProcessor, AutoModelForVision2Seq, RawImage } = await import(TRANSFORMERS);

const MODEL = 'HuggingFaceTB/SmolVLM-256M-Instruct';
let processor = null;
let model = null;

export async function loadVLM() {
  const webgpu = runtime.device === 'webgpu';
  const dtype = webgpu
    ? { embed_tokens: runtime.f16 ? 'fp16' : 'fp32', vision_encoder: 'q4', decoder_model_merged: 'q4' }
    : 'q8';
  await timed('load.vlm', async () => {
    processor = await AutoProcessor.from_pretrained(MODEL);
    model = await AutoModelForVision2Seq.from_pretrained(MODEL, { device: runtime.device, dtype });
  });
}

export async function unloadVLM() {
  await model?.dispose?.();
  model = null;
  processor = null;
}

export const isVLMLoaded = () => !!model;

export async function describe(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const image = new RawImage(data, canvas.width, canvas.height, 4).rgb();
  const messages = [{
    role: 'user',
    content: [
      { type: 'image' },
      { type: 'text', text: 'Describe this household object concretely: what it is, colours, materials, condition, stickers, marks or anything unusual. Two or three sentences.' },
    ],
  }];
  const text = processor.apply_chat_template(messages, { add_generation_prompt: true });
  const inputs = await processor(text, [image], { do_image_splitting: false });
  const ids = await model.generate({ ...inputs, max_new_tokens: 120, do_sample: false });
  const [out] = processor.batch_decode(ids.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
  return out.trim();
}
