/**
 * Test script for all Jarvis integrations.
 * Run with: npx tsx --tsconfig tsconfig.json scripts/test-integrations.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

// ─── Colors ───────────────────────────────────────────────────────────────────
const green = (s: string) => `\x1b[32m✅ ${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m❌ ${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m⚠️  ${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m\n── ${s} ──\x1b[0m`;

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
  console.log(green(label) + (detail ? `  →  ${detail}` : ''));
  passed++;
}

function fail(label: string, error?: unknown) {
  console.log(red(label));
  if (error) console.log('   ', String(error).split('\n')[0]);
  failed++;
}

async function main() {
  // ─── 1. ENV VARS ───────────────────────────────────────────────────────────
  console.log(cyan('1. Environment Variables'));

  const requiredEnvs = [
    'NOTION_API_KEY',
    'TRIGGER_SECRET_KEY',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_TOKEN',
    'EVOLUTION_INSTANCE',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  for (const key of requiredEnvs) {
    if (process.env[key]) {
      ok(key, process.env[key]!.slice(0, 12) + '...');
    } else {
      fail(`${key} não configurada`);
    }
  }

  // ─── 2. NOTION — searchProjects (banco DRM) ─────────────────────────────────
  console.log(cyan('2. Notion — searchProjects (Projetos DRM)'));
  try {
    const { NotionService } = await import('../src/lib/notion-service');
    const projects = await NotionService.getAllProjects();
    if (projects.length > 0) {
      ok(`Encontrou ${projects.length} projetos no banco DRM`, projects[0].title);
    } else {
      fail('Banco DRM retornou 0 projetos — verifique NOTION_API_KEY e o DATABASE_ID');
    }
  } catch (e) {
    fail('Erro ao conectar com Notion (DRM)', e);
  }

  // ─── 3. NOTION — searchAll (workspace geral) ────────────────────────────────
  console.log(cyan('3. Notion — searchAll (workspace completo)'));
  try {
    const { NotionService } = await import('../src/lib/notion-service');
    const results = await NotionService.searchAll('projeto');
    if (results.length > 0) {
      ok(`Encontrou ${results.length} itens no workspace`, results[0].title);
      results.slice(0, 5).forEach(r => console.log(`   • [${r.type}] ${r.title}`));
    } else {
      fail('searchAll retornou 0 resultados');
    }
  } catch (e) {
    fail('Erro no searchAll do Notion', e);
  }

  // ─── 4. EVOLUTION API — conectividade ───────────────────────────────────────
  console.log(cyan('4. Evolution API — Conectividade'));
  try {
    const url = process.env.EVOLUTION_API_URL!;
    const token = process.env.EVOLUTION_API_TOKEN!;
    const instance = process.env.EVOLUTION_INSTANCE!;

    const res = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: token },
    });

    if (res.ok) {
      const data = await res.json() as Array<{ name?: string; connectionStatus?: string; instance?: { instanceName?: string; state?: string } }>;
      // Suporta Evolution API v1 (instance.instanceName) e v2 (name)
      const inst = data.find((i) => i.name === instance || i.instance?.instanceName === instance);
      if (inst) {
        const status = inst.connectionStatus || inst.instance?.state || '?';
        ok(`Instância "${instance}" encontrada`, `status: ${status}`);
      } else {
        fail(`Instância "${instance}" não encontrada na Evolution API`);
      }
    } else {
      fail(`Evolution API respondeu ${res.status}`, await res.text());
    }
  } catch (e) {
    fail('Erro ao conectar com Evolution API', e);
  }

  // ─── 5. TRIGGER.DEV — autenticação ──────────────────────────────────────────
  console.log(cyan('5. Trigger.dev — Autenticação + Reminder de teste'));
  try {
    const key = process.env.TRIGGER_SECRET_KEY || '';
    const env = key.startsWith('tr_prod') ? 'PRODUÇÃO' : key.startsWith('tr_dev') ? 'DESENVOLVIMENTO' : 'DESCONHECIDO';

    if (env === 'PRODUÇÃO') {
      ok(`Chave de ${env} configurada`);
    } else if (env === 'DESENVOLVIMENTO') {
      console.log(yellow(`Chave de DESENVOLVIMENTO — rode "npx trigger.dev@latest dev" em outro terminal para processar o run`));
    } else {
      fail('Chave inválida ou não configurada');
    }

    const { reminderTask } = await import('../src/trigger/reminder');
    const run = await reminderTask.trigger(
      {
        senderPhone: process.env.EVOLUTION_BOT_NUMBER || '5511949633602',
        jid: `${process.env.EVOLUTION_BOT_NUMBER || '5511949633602'}@s.whatsapp.net`,
        isGroup: false,
        reminder: '🧪 Teste do Jarvis — reminder funcionando!',
      },
      { delay: new Date(Date.now() + 60_000) }
    );
    ok(`Run criado`, `ID: ${run.id} — dispara em ~1 minuto`);
  } catch (e) {
    fail('Erro ao criar run no Trigger.dev', e);
  }

  // ─── 6. SUPABASE — conectividade ────────────────────────────────────────────
  console.log(cyan('6. Supabase — Conectividade'));
  try {
    const { supabase } = await import('../src/db');
    const { count, error } = await supabase.from('chats').select('*', { count: 'exact', head: true });
    if (error) throw error;
    ok(`Supabase conectado`, `chats table: ${count ?? 0} registros`);
  } catch (e) {
    fail('Erro ao conectar com Supabase', e);
  }

  // ─── 7. REMINDER PARSING — LLM ──────────────────────────────────────────────
  console.log(cyan('7. Reminder Parsing — LLM'));
  try {
    const nowMs = Date.now();
    const { generateText } = await import('ai');
    const { getModel } = await import('../src/lib/ai-provider');

    const result = await generateText({
      model: getModel(),
      system: `Extraia o lembrete. Unix timestamp atual: ${nowMs}ms.
Retorne JSON: {"what": string, "whenMs": number}
"daqui a 5 minutos" = ${nowMs} + 300000`,
      messages: [{ role: 'user', content: 'Me lembre de testar o sistema daqui a 5 minutos' }],
    });

    const raw = result.text.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(raw) as { what?: string; whenMs?: number };
    const diff = (parsed.whenMs ?? 0) - nowMs;
    const diffMin = Math.round(diff / 60000);

    if (parsed.what && parsed.whenMs && diff > 0) {
      ok(`LLM parseou corretamente`, `"${parsed.what}" em ~${diffMin} min`);
    } else {
      fail('LLM retornou dados inválidos', JSON.stringify(parsed));
    }
  } catch (e) {
    fail('Erro no reminder parsing', e);
  }

  // ─── Resumo ─────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Resultado: ${passed} passou, ${failed} falhou`);
  if (failed === 0) {
    console.log(green('Tudo funcionando!'));
  } else {
    console.log(red(`${failed} teste(s) precisam de atenção`));
  }
}

main().catch(console.error);
