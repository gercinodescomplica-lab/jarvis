import { supabase } from '@/db';
import { generateEmbedding, chunkText } from './embeddings';
import { createLogger } from './logger';
import fs from 'fs';
import path from 'path';

const logger = createLogger('memory');

function isInJsonWhitelist(phone: string): boolean {
  try {
    const filePath = path.join(process.cwd(), 'jarvis-permissions.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const inUsers = !!Object.entries(data.users || {}).find(([k]) => phone.includes(k));
    const inGroups = !!Object.values(data.groups || {}).find((g: any) => g.jid === phone);
    return inUsers || inGroups;
  } catch {
    return false;
  }
}

// ─── Whitelist ────────────────────────────────────────────────────────────────

export async function isWhitelisted(phone: string): Promise<boolean> {
  const cleanPhone = phone.replace(/\D/g, '');
  const { data } = await supabase
    .from('whitelist')
    .select('active')
    .eq('phone', cleanPhone)
    .maybeSingle();
  return !!data?.active;
}

export async function canStoreMemory(phone: string): Promise<boolean> {
  const cleanPhone = phone.replace(/\D/g, '');
  const { data } = await supabase
    .from('whitelist')
    .select('active, can_store_memory')
    .eq('phone', cleanPhone)
    .maybeSingle();

  // Se não está no DB, aceita quem está no JSON de permissões
  if (data == null) return isInJsonWhitelist(phone);

  return !!data?.active && !!data?.can_store_memory;
}

export async function getUserName(phone: string): Promise<string | null> {
  const cleanPhone = phone.replace(/\D/g, '');
  const { data } = await supabase
    .from('whitelist')
    .select('name')
    .eq('phone', cleanPhone)
    .maybeSingle();
  return data?.name || null;
}

// ─── Memórias ────────────────────────────────────────────────────────────────

const DEDUP_SIMILARITY_THRESHOLD = 0.92;

async function isMemoryDuplicate(embedding: number[], phone: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('memories')
      .select('embedding')
      .eq('phone', phone)
      .limit(200);

    if (!data || data.length === 0) return false;

    for (const row of data) {
      if (!row.embedding) continue;
      const existing: number[] = typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding;

      // Cosine similarity
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < embedding.length; i++) {
        dot += embedding[i] * existing[i];
        normA += embedding[i] ** 2;
        normB += existing[i] ** 2;
      }
      const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
      if (similarity >= DEDUP_SIMILARITY_THRESHOLD) return true;
    }
    return false;
  } catch {
    return false; // Em caso de erro, permite salvar
  }
}

export async function saveMemory(content: string, phone: string, source: 'pdf' | 'message') {
  const embedding = await generateEmbedding(content);

  const duplicate = await isMemoryDuplicate(embedding, phone);
  if (duplicate) {
    logger.info(`Memória duplicada ignorada: "${content.slice(0, 60)}"`);
    return;
  }

  const { error } = await supabase.from('memories').insert({
    id: crypto.randomUUID(),
    phone,
    content,
    source,
    embedding,
    created_at: Date.now(),
  });

  if (error) throw error;

  logger.info(`Memória salva: "${content.slice(0, 60)}"`);
}

export async function searchMemories(query: string, owner: string, limit = 5): Promise<string[]> {
  let embedding: number[];
  try {
    embedding = await generateEmbedding(query);
  } catch {
    return []; // embedding indisponível (ex: chave Gemini inválida)
  }

  const { data, error } = await supabase.rpc('search_memories', {
    query_embedding: embedding,
    match_count: limit,
    owner_id: owner,
  });

  if (error) throw error;

  return (data ?? []).map((r: { content: string }) => r.content);
}

// ─── Documentos (PDF) ────────────────────────────────────────────────────────

function extractTitle(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function saveDocument(
  pdfBuffer: Buffer,
  filename: string,
  uploaderPhone: string
): Promise<string> {
  logger.info(` ▶ Iniciando processamento: "${filename}" (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  logger.info(` 📄 Extraindo texto...`);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
  let parsed: { text: string; numpages: number };
  try {
    parsed = await pdfParse(pdfBuffer);
  } catch (parseErr: any) {
    const msg = String(parseErr?.message || parseErr);
    logger.error(` ❌ Falha ao parsear "${filename}":`, msg);
    if (msg.includes('XRef') || msg.includes('FormatError') || msg.includes('Invalid PDF')) {
      throw new Error('O PDF parece estar corrompido ou em formato inválido. Tente reenviar o arquivo original.');
    }
    throw new Error('Não foi possível ler o PDF. Verifique se o arquivo não está protegido por senha ou danificado.');
  }
  const text = parsed.text;

  if (!text || text.trim().length < 10) {
    logger.error(` ❌ PDF sem texto extraível: "${filename}"`);
    throw new Error('PDF sem texto extraível (pode ser escaneado/imagem).');
  }

  // Remove null bytes e caracteres de controle que o PostgreSQL rejeita
  const cleanText = text.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  logger.info(` ✅ Texto extraído: ${cleanText.length} caracteres, ${parsed.numpages} página(s)`);

  const documentTitle = extractTitle(filename);
  logger.info(` 📌 Título do documento: "${documentTitle}"`);

  // Registra o documento
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      id: crypto.randomUUID(),
      uploader_phone: uploaderPhone,
      filename,
      description: documentTitle,
      total_chunks: 0,
      created_at: Date.now(),
    })
    .select('id')
    .single();

  if (docError) throw docError;
  logger.info(` 💾 Documento registrado no Supabase (id: ${doc.id})`);

  // Gera e salva chunks com embeddings
  const chunks = chunkText(cleanText);
  logger.info(` 🔪 Texto dividido em ${chunks.length} chunks — gerando embeddings...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const enrichedChunk = `[Documento: ${documentTitle}]\n${chunk}`;
    const embedding = await generateEmbedding(enrichedChunk);

    const { error } = await supabase.from('document_chunks').insert({
      id: crypto.randomUUID(),
      document_id: doc.id,
      document_title: documentTitle,
      chunk_index: i,
      content: chunk,
      embedding,
      created_at: Date.now(),
    });

    if (error) throw error;
    logger.info(` ⚡ Chunk ${i + 1}/${chunks.length} salvo`);
  }

  // Atualiza contagem de chunks
  const { error: updateError } = await supabase
    .from('documents')
    .update({ total_chunks: chunks.length })
    .eq('id', doc.id);

  if (updateError) throw updateError;

  logger.info(` ✅ "${filename}" processado com sucesso: ${chunks.length} chunks salvos no Supabase`);
  return doc.id;
}

export async function searchDocuments(query: string, owner: string, limit = 5): Promise<string[]> {
  let embedding: number[];
  try {
    embedding = await generateEmbedding(query);
  } catch {
    return []; // embedding indisponível
  }

  const { data, error } = await supabase.rpc('search_document_chunks', {
    query_embedding: embedding,
    match_count: limit,
    owner_id: owner,
  });

  if (error) throw error;

  return (data ?? []).map((r: { content: string; document_title: string | null }) =>
    r.document_title ? `[${r.document_title}] ${r.content}` : r.content
  );
}

// ─── Histórico semântico de chat ─────────────────────────────────────────────

export async function getSemanticHistory(
  currentMessage: string,
  phone: string,
  maxMessages = 10
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const { data: rawHistory } = await supabase
    .from('chats')
    .select('role, content, created_at')
    .eq('phone', phone)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(30);

  if (!rawHistory || rawHistory.length === 0) return [];

  // Pontuação: 0.6 * recência + 0.4 * overlap de palavras como proxy semântico
  const currentWords = new Set(currentMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  const scored = rawHistory.map((msg, idx) => {
    const recency = 1 - idx / rawHistory.length;

    let similarity = 0;
    if (msg.role === 'user' && currentWords.size > 0) {
      const msgWords = msg.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      const overlap = msgWords.filter((w: string) => currentWords.has(w)).length;
      similarity = Math.min(overlap / currentWords.size, 1);
    }

    return { msg, score: 0.6 * recency + 0.4 * similarity };
  });

  // Top maxMessages por score, reordenados cronologicamente
  const selected = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMessages)
    .sort((a, b) => a.msg.created_at - b.msg.created_at);

  return selected.map(s => ({
    role: s.msg.role as 'user' | 'assistant',
    content: s.msg.content,
  }));
}

// ─── Contexto semântico para o LLM ───────────────────────────────────────────

export async function getMemoryContext(query: string, owner: string): Promise<string> {
  try {
    const [memories, docChunks] = await Promise.all([
      searchMemories(query, owner, 3),
      searchDocuments(query, owner, 3),
    ]);

    const parts: string[] = [];

    if (memories.length > 0) {
      parts.push(`MEMÓRIAS RELEVANTES:\n${memories.map(m => `- ${m}`).join('\n')}`);
    }

    if (docChunks.length > 0) {
      parts.push(`TRECHOS DE DOCUMENTOS RELEVANTES:\n${docChunks.map(d => `- ${d}`).join('\n')}`);
    }

    if (parts.length === 0) return '';

    return `\n\n${parts.join('\n\n')}\n\n`;
  } catch {
    return '';
  }
}
