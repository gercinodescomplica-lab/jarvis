-- ============================================================
-- JARVIS - Migração para Supabase
-- Execute este arquivo no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Habilita a extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela de histórico de chats
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS chats_phone_created_idx ON chats (phone, created_at DESC);

-- 3. Whitelist de usuários
CREATE TABLE IF NOT EXISTS whitelist (
  phone TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  can_store_memory BOOLEAN DEFAULT false NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- 4. Registro de documentos enviados
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_phone TEXT NOT NULL,
  filename TEXT NOT NULL,
  description TEXT,
  total_chunks INTEGER DEFAULT 0 NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- 5. Chunks de documentos com embedding vetorial
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_title TEXT,
  chunk_index INTEGER,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 6. Memórias salvas manualmente com embedding vetorial
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  embedding vector(768),
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 7. Função RPC para busca semântica em memórias
CREATE OR REPLACE FUNCTION search_memories(query_embedding vector(768), match_count int)
RETURNS TABLE (content text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT m.content
    FROM memories m
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 8. Função RPC para busca semântica em chunks de documentos
CREATE OR REPLACE FUNCTION search_document_chunks(query_embedding vector(768), match_count int)
RETURNS TABLE (content text, document_title text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
    SELECT dc.content, dc.document_title
    FROM document_chunks dc
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 9. Função auxiliar chamada pelo init-vectors.ts (noop, só confirma que pgvector existe)
CREATE OR REPLACE FUNCTION enable_pgvector()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- pgvector já está habilitado via CREATE EXTENSION acima
  RETURN;
END;
$$;
