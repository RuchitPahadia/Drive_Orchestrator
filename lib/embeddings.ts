/**
 * @file lib/embeddings.ts
 * @description CLIP ViT-B/32 vision-language embedding service using @huggingface/transformers (ONNX runtime).
 * Produces 512-dimensional vector embeddings for text queries and image thumbnails, enabling
 * cross-modal semantic search in Supabase PostgreSQL via pgvector.
 * @phase Phase 8: CLIP Semantic Search & Phase 12: Production Polish
 */

import {
  AutoTokenizer,
  AutoProcessor,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
} from '@huggingface/transformers';

/** Pretrained HuggingFace ONNX-quantized model repository ID */
const MODEL_ID = 'Xenova/clip-vit-base-patch32';

// Note: @huggingface/transformers does not export explicit TypeScript interfaces for model instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenizer: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let textModel: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let visionModel: any = null;

/**
 * Normalizes a numeric vector to unit Euclidean length (L2 norm = 1.0).
 * Unit normalization ensures that dot product equals cosine similarity, matching
 * PostgreSQL pgvector's vector_cosine_ops (<=>) distance calculation.
 * 
 * @param vector - Raw numeric array of embedding dimensions.
 * @returns Normalized float array with L2 length equal to 1.0.
 */
function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

/**
 * Lazy singleton loader for the CLIP text tokenizer and text projection model.
 * Reuses the instantiated ONNX session to prevent memory leaks.
 * 
 * @returns Object containing the loaded tokenizer and textModel.
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
 * Lazy singleton loader for the CLIP image processor and vision projection model.
 * Reuses the instantiated ONNX session to prevent memory leaks.
 * 
 * @returns Object containing the loaded processor and visionModel.
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
 * 
 * @param query - Natural language search string (e.g. "sunset on a beach", "family dinner").
 * @returns Promise resolving to a 512-element normalized float array.
 */
export async function generateTextEmbedding(query: string): Promise<number[]> {
  const { tokenizer, textModel } = await getTextModel();
  const textInputs = tokenizer([query], { padding: true, truncation: true });
  const { text_embeds } = await textModel(textInputs);
  return normalize(Array.from(text_embeds.data as Float32Array));
}

/**
 * Generates a normalized 512-dimensional vector embedding for an image buffer (e.g. thumbnail).
 * 
 * @param imageBuffer - Node.js Buffer containing image bytes (JPEG, PNG, WebP).
 * @returns Promise resolving to a 512-element normalized float array.
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
 * Formats a numeric array into a PostgreSQL pgvector literal string representation.
 * Example output: `'[0.0123,-0.0456,...]'`
 * 
 * @param vector - Float array of embedding values.
 * @returns PostgreSQL vector literal string suitable for parameterized queries.
 */
export function formatVectorForPostgres(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
