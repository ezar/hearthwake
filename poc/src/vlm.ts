// Small vision-language model that describes the selected object.
import type { PreTrainedModel, Processor, RawImage as RawImageType, Tensor } from '@huggingface/transformers';
import { timed } from './report';
import { runtime } from './runtime';

const MODEL = 'HuggingFaceTB/SmolVLM-256M-Instruct';
const PROMPT =
  'Describe this household object concretely: what it is, its colours, materials and condition, ' +
  'and any stickers, marks or anything unusual. Two or three sentences.';

let processor: Processor | null = null;
let model: PreTrainedModel | null = null;
let RawImage: typeof RawImageType | null = null;

export async function loadVLM(): Promise<void> {
  const tf = await import('@huggingface/transformers');
  RawImage = tf.RawImage;
  const dtype =
    runtime.device === 'webgpu'
      ? ({
          embed_tokens: runtime.f16 ? 'fp16' : 'fp32',
          vision_encoder: 'q4',
          decoder_model_merged: 'q4',
        } as const)
      : 'q8';
  await timed('load.vlm', async () => {
    processor = await tf.AutoProcessor.from_pretrained(MODEL, {});
    model = await tf.AutoModelForVision2Seq.from_pretrained(MODEL, { device: runtime.device, dtype });
  });
}

export async function unloadVLM(): Promise<void> {
  await model?.dispose();
  model = null;
  processor = null;
}

export async function describe(canvas: HTMLCanvasElement): Promise<string> {
  if (!processor || !model || !RawImage) throw new Error('Carga el modelo de visión primero');
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  const image = new RawImage(data, canvas.width, canvas.height, 4).rgb();
  const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: PROMPT }] }];
  const text = processor.apply_chat_template(messages as never, { add_generation_prompt: true }) as string;
  const inputs = await processor(text, [image], { do_image_splitting: false });
  const ids = (await model.generate({ ...inputs, max_new_tokens: 120, do_sample: false })) as Tensor;
  const promptLength = (inputs.input_ids as Tensor).dims.at(-1)!;
  const [out] = processor.batch_decode(ids.slice(null, [promptLength, ids.dims.at(-1)!]), {
    skip_special_tokens: true,
  });
  return (out ?? '').trim();
}
