/**
 * Seed: popula o Supabase com os usuários do jarvis-permissions.json
 * e diagnóstica tabelas existentes.
 * Run: npx tsx --tsconfig tsconfig.json scripts/seed-admin.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const green = (s: string) => `\x1b[32m✅ ${s}\x1b[0m`;
const red   = (s: string) => `\x1b[31m❌ ${s}\x1b[0m`;
const cyan  = (s: string) => `\x1b[36m\n── ${s} ──\x1b[0m`;

async function main() {
  // ── 1. Diagnóstico: tabelas existentes ────────────────────────────────────
  console.log(cyan('1. Tabelas no Supabase'));
  const tables = ['whitelist', 'memories', 'documents', 'document_chunks', 'chats'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) console.log(red(`${t}: ${error.message}`));
    else       console.log(green(`${t}: ${count} registros`));
  }

  // ── 2. Seed whitelist a partir do JSON ────────────────────────────────────
  console.log(cyan('2. Seed Whitelist'));
  const permsPath = path.join(process.cwd(), 'jarvis-permissions.json');
  const perms = JSON.parse(fs.readFileSync(permsPath, 'utf8'));

  const users = Object.entries(perms.users || {}).map(([phone, info]: [string, any]) => ({
    phone,
    name: info.name,
    can_store_memory: true,   // todos com permissão total
    active: true,
  }));

  if (users.length === 0) {
    console.log(red('Nenhum usuário encontrado no JSON'));
  } else {
    for (const u of users) {
      const { error } = await supabase
        .from('whitelist')
        .upsert(u, { onConflict: 'phone' });
      if (error) console.log(red(`Erro ao inserir ${u.phone} (${u.name}): ${error.message}`));
      else       console.log(green(`${u.name} (${u.phone}) inserido/atualizado`));
    }
  }

  // ── 3. Verifica se tabela reminders existe (via DATABASE_URL) ─────────────
  console.log(cyan('3. Tabela reminders (Postgres direto)'));
  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(process.env.DATABASE_URL!);
    const rows = await sql`SELECT COUNT(*) as total, SUM(CASE WHEN sent = false THEN 1 ELSE 0 END) as pending FROM reminders`;
    console.log(green(`reminders: ${rows[0].total} total, ${rows[0].pending} pendentes`));
    await sql.end();
  } catch (e: any) {
    if (e.message?.includes('does not exist')) {
      console.log(red('Tabela reminders não existe → criando...'));
      // Tenta criar via Supabase SQL (mesmo banco)
      const postgres = (await import('postgres')).default;
      const sql = postgres(process.env.DATABASE_URL!);
      await sql`
        CREATE TABLE IF NOT EXISTS reminders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message TEXT NOT NULL,
          remind_at TIMESTAMPTZ NOT NULL,
          chat_id TEXT NOT NULL DEFAULT '',
          sent BOOLEAN DEFAULT false NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      console.log(green('Tabela reminders criada!'));
      await sql.end();
    } else {
      console.log(red(`Erro reminders: ${e.message}`));
    }
  }

  // ── 4. Resumo final ───────────────────────────────────────────────────────
  console.log(cyan('4. Whitelist final no Supabase'));
  const { data } = await supabase.from('whitelist').select('phone, name, active, can_store_memory');
  (data ?? []).forEach((u: any) => console.log(`   • ${u.name} (${u.phone}) | ativo: ${u.active} | mem: ${u.can_store_memory}`));
}

main().catch(console.error);
