import { GoogleGenerativeAI } from '@google/generative-ai';

// gemini-embedding-001: suporta outputDimensionality, usando 768 para compatibilidade com Turso
export const EMBEDDING_DIMENSIONS = 768;

export async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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

// Divide texto em chunks semânticos respeitando sentenças e parágrafos
export function chunkText(text: string, maxChunkSize = 600, overlapSentences = 1): string[] {
  // 1. Divide por parágrafos (double newline)
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  // 2. Divide parágrafos longos em sentenças
  const sentenceBreak = /(?<=[.!?])\s+(?=[A-ZÀ-Ú])|(?<=\n)/;
  const sentences: string[] = [];
  for (const para of paragraphs) {
    if (para.length <= maxChunkSize) {
      sentences.push(para);
    } else {
      const parts = para.split(sentenceBreak).map(s => s.trim()).filter(s => s.length > 0);
      sentences.push(...parts);
    }
  }

  // 3. Agrupa sentenças em chunks até maxChunkSize com overlap de 1 sentença
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const sentence of sentences) {
    if (currentLen + sentence.length + 1 > maxChunkSize && current.length > 0) {
      chunks.push(current.join(' ').trim());
      // Overlap: mantém última sentença do chunk anterior
      const overlap = current.slice(-overlapSentences);
      current = [...overlap, sentence];
      currentLen = overlap.reduce((acc, s) => acc + s.length + 1, 0) + sentence.length;
    } else {
      current.push(sentence);
      currentLen += sentence.length + 1;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(' ').trim());
  }

  return chunks.filter(c => c.length > 30);
}
