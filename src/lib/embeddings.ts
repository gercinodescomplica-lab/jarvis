import { GoogleGenerativeAI } from '@google/generative-ai';

// gemini-embedding-001: suporta outputDimensionality, usando 768 para compatibilidade com Turso
export const EMBEDDING_DIMENSIONS = 768;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  const result = await model.embedContent({
    content: { parts: [{ text: text.slice(0, 2000) }], role: 'user' },
    outputDimensionality: 768,
  } as Parameters<typeof model.embedContent>[0]);
  return result.embedding.values;
}

// Converte number[] para string JSON que o Turso aceita em vector32()
export function toVector32(embedding: number[]): string {
  return JSON.stringify(embedding);
}

// Divide texto em chunks de ~500 chars com overlap de 50 chars
export function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    start += chunkSize - overlap;
  }

  return chunks.filter(c => c.length > 20);
}
