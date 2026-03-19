/**
 * Sobe as migrations no Supabase via conexão direta PostgreSQL.
 *
 * Pré-requisito: adicionar no .env
 *   DATABASE_URL=postgresql://postgres.PROJECT_ID:SENHA@aws-0-us-east-1.pooler.supabase.com:5432/postgres
 *
 * A connection string fica em: Supabase Dashboard → Settings → Database → Connection String → URI
 * (Use o "Session mode" na porta 5432, não o Transaction na 6543)
 *
 * Uso: npx tsx scripts/migrate-supabase.ts
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida no .env');
  console.error('');
  console.error('Copie a connection string do Supabase Dashboard:');
  console.error('  Settings → Database → Connection String → Session mode (porta 5432)');
  console.error('');
  console.error('Exemplo:');
  console.error('  DATABASE_URL=postgresql://postgres.SEU_PROJECT_ID:SUA_SENHA@aws-0-us-east-1.pooler.supabase.com:5432/postgres');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

async function migrate() {
  console.log('🔌 Conectando ao Supabase...\n');

  try {
    // 1. pgvector
    console.log('📦 Habilitando extensão pgvector...');
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('   ✅ vector OK\n');

    // 2. chats
    console.log('📋 Criando tabela chats...');
    await sql`
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS chats_phone_created_idx ON chats (phone, created_at DESC)`;
    console.log('   ✅ chats OK\n');

    // 3. whitelist
    console.log('📋 Criando tabela whitelist...');
    await sql`
      CREATE TABLE IF NOT EXISTS whitelist (
        phone TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        can_store_memory BOOLEAN DEFAULT false NOT NULL,
        active BOOLEAN DEFAULT true NOT NULL,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
      )
    `;
    console.log('   ✅ whitelist OK\n');

    // 4. documents
    console.log('📋 Criando tabela documents...');
    await sql`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        uploader_phone TEXT NOT NULL,
        filename TEXT NOT NULL,
        description TEXT,
        total_chunks INTEGER DEFAULT 0 NOT NULL,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
      )
    `;
    console.log('   ✅ documents OK\n');

    // 5. document_chunks
    console.log('📋 Criando tabela document_chunks...');
    await sql`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        document_title TEXT,
        chunk_index INTEGER,
        content TEXT NOT NULL,
        embedding vector(768),
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS chunks_embedding_idx
        ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)
    `;
    console.log('   ✅ document_chunks OK\n');

    // 6. memories
    console.log('📋 Criando tabela memories...');
    await sql`
      CREATE TABLE IF NOT EXISTS memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone TEXT,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        embedding vector(768),
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS memories_embedding_idx
        ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10)
    `;
    console.log('   ✅ memories OK\n');

    // 7. RPC: search_memories
    console.log('⚙️  Criando função search_memories...');
    await sql`
      CREATE OR REPLACE FUNCTION search_memories(query_embedding vector(768), match_count int)
      RETURNS TABLE (content text)
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN QUERY
          SELECT m.content FROM memories m
          ORDER BY m.embedding <=> query_embedding
          LIMIT match_count;
      END;
      $$
    `;
    console.log('   ✅ search_memories OK\n');

    // 8. RPC: search_document_chunks
    console.log('⚙️  Criando função search_document_chunks...');
    await sql`
      CREATE OR REPLACE FUNCTION search_document_chunks(query_embedding vector(768), match_count int)
      RETURNS TABLE (content text, document_title text)
      LANGUAGE plpgsql AS $$
      BEGIN
        RETURN QUERY
          SELECT dc.content, dc.document_title FROM document_chunks dc
          ORDER BY dc.embedding <=> query_embedding
          LIMIT match_count;
      END;
      $$
    `;
    console.log('   ✅ search_document_chunks OK\n');

    // 9. RPC: enable_pgvector (noop usado pelo init-vectors.ts)
    console.log('⚙️  Criando função enable_pgvector...');
    await sql`
      CREATE OR REPLACE FUNCTION enable_pgvector()
      RETURNS void LANGUAGE plpgsql AS $$
      BEGIN RETURN; END;
      $$
    `;
    console.log('   ✅ enable_pgvector OK\n');

    // Verificação final
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    console.log('📊 Tabelas no banco:');
    tables.forEach(t => console.log(`   - ${t.tablename}`));

    console.log('\n✅ Migration concluída com sucesso!');
  } catch (err) {
    console.error('\n❌ Erro na migration:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
