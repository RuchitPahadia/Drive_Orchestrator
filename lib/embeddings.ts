import {
  AutoTokenizer,
  AutoProcessor,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@huggingface/transformers';

const MODEL_ID = 'Xenova/clip-vit-base-patch32';

let tokenizer: any = null;
let textModel: any = null;
let processor: any = null;
let visionModel: any = null;

/**
 * Normalizes a numeric array to a unit vector (L2 norm = 1.0) for cosine distance.
 */
function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

/**
 * Lazy singleton loader for CLIP tokenizer and text encoder model.
 */
export async function getTextModel() {
  if (!tokenizer || !textModel) {
    console.log(`[CLIP Service] Loading text model: ${MODEL_ID}...`);
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID);
  }
  return { tokenizer, textModel };
}

/**
 * Lazy singleton loader for CLIP image processor and vision encoder model.
 */
export async function getVisionModel() {
  if (!processor || !visionModel) {
    console.log(`[CLIP Service] Loading vision model: ${MODEL_ID}...`);
    processor = await AutoProcessor.from_pretrained(MODEL_ID);
    visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID);
  }
  return { processor, visionModel };
}

/**
 * Generates a normalized 512-dimensional vector embedding for a natural language text query.
 * @param query Natural language search string (e.g. "sunset on a beach", "family dinner")
 * @returns 512-element normalized float array
 */
export async function generateTextEmbedding(query: string): Promise<number[]> {
  const { tokenizer, textModel } = await getTextModel();
  const textInputs = tokenizer([query], { padding: true, truncation: true });
  const { text_embeds } = await textModel(textInputs);
  return normalize(Array.from(text_embeds.data as Float32Array));
}

/**
 * Generates a normalized 512-dimensional vector embedding for an image buffer (e.g. thumbnail).
 * @param imageBuffer Node.js Buffer containing image bytes (JPEG, PNG, WebP)
 * @returns 512-element normalized float array
 */
export async function generateImageEmbedding(imageBuffer: Buffer): Promise<number[]> {
  const { processor, visionModel } = await getVisionModel();
  const blob = new Blob([imageBuffer as unknown as BlobPart]);
  const image = await RawImage.read(blob);
  const inputs = await processor(image);
  const { image_embeds } = await visionModel(inputs);
  return normalize(Array.from(image_embeds.data as Float32Array));
}

/**
 * Formats a numeric array into a PostgreSQL pgvector literal string: '[0.0123,-0.0456,...]'
 */
export function formatVectorForPostgres(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
