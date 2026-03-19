// Script para migrar jarvis-permissions.json para a tabela whitelist no Turso
// Executar: npx tsx scripts/seed-whitelist.ts

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const whitelist = sqliteTable('whitelist', {
  phone: text('phone').primaryKey(),
  name: text('name').notNull(),
  canStoreMemory: integer('can_store_memory', { mode: 'boolean' }).default(false).notNull(),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle({ client });

  // Cria tabela se não existir
  await client.execute(`
    CREATE TABLE IF NOT EXISTS whitelist (
      phone TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      can_store_memory INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER
    )
  `);

  // Lê o JSON existente
  const jsonPath = path.join(process.cwd(), 'jarvis-permissions.json');
  const perms = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const entries = Object.entries(perms.users || {}) as [string, { name: string; permission: string }][];

  for (const [phone, data] of entries) {
    await db.insert(whitelist).values({
      phone,
      name: data.name,
      canStoreMemory: true, // todos os usuários individuais do JSON podem salvar
      active: true,
    }).onConflictDoNothing();

    console.log(`✅ Adicionado: ${data.name} (${phone})`);
  }

  console.log('\nWhitelist migrada com sucesso!');
  console.log('Para adicionar novos usuários, insira diretamente na tabela "whitelist" no Turso.');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
