/**
 * Script de seed + teste de lembretes
 * Uso: npx tsx scripts/seed-reminders-test.ts
 *
 * 1. Aplica a migração de schema (idempotente)
 * 2. Insere 10 lembretes variados para o usuário Gercino
 * 3. Consulta e exibe como o Jarvis responderia
 */

import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

// Phone como o WhatsApp entrega — com DDI 55
const PHONE = '5511949633602';
const JID   = `${PHONE}@s.whatsapp.net`;

// ─── 1. Migração ─────────────────────────────────────────────────────────────

async function applyMigration() {
  console.log('\n📦 Aplicando migração de schema...');
  await applyMigrationViaPg();
}

async function applyMigrationViaPg() {
  const migSql = postgres(process.env.DATABASE_URL!);

  await migSql`
    ALTER TABLE public.reminders
      ADD COLUMN IF NOT EXISTS phone          TEXT,
      ADD COLUMN IF NOT EXISTS jid            TEXT,
      ADD COLUMN IF NOT EXISTS is_group       BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS trigger_run_id TEXT,
      ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'pending'
                                              CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
      ADD COLUMN IF NOT EXISTS source         TEXT NOT NULL DEFAULT 'whatsapp'
                                              CHECK (source IN ('whatsapp', 'telegram', 'chat')),
      ADD COLUMN IF NOT EXISTS priority       TEXT NOT NULL DEFAULT 'normal'
                                              CHECK (priority IN ('low', 'normal', 'high')),
      ADD COLUMN IF NOT EXISTS recurrence     TEXT
  `;

  await migSql`UPDATE public.reminders SET status = 'sent' WHERE sent = true AND status = 'pending'`;
  await migSql`
    CREATE INDEX IF NOT EXISTS idx_reminders_phone_status
      ON public.reminders(phone, status, remind_at)
  `;
  await migSql`
    CREATE INDEX IF NOT EXISTS idx_reminders_trigger_run_id
      ON public.reminders(trigger_run_id) WHERE trigger_run_id IS NOT NULL
  `;

  await migSql.end();
  console.log('  ✅ Schema atualizado via postgres driver');
}

// ─── 2. Seed ─────────────────────────────────────────────────────────────────

function daysAgo(n: number)   { return new Date(Date.now() - n * 86_400_000).toISOString(); }
function daysAhead(n: number) { return new Date(Date.now() + n * 86_400_000).toISOString(); }
function hoursAhead(n: number){ return new Date(Date.now() + n * 3_600_000).toISOString(); }

const SEED_REMINDERS = [
  // ── Passado – sent ────────────────────────────────────────────────────────
  {
    message: 'Enviar relatório de desempenho para a Lici',
    remind_at: daysAgo(7),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_001',
    status: 'sent', source: 'whatsapp', priority: 'high', sent: true,
  },
  {
    message: 'Ligar para o fornecedor sobre o contrato de licença',
    remind_at: daysAgo(5),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_002',
    status: 'sent', source: 'whatsapp', priority: 'normal', sent: true,
  },
  {
    message: 'Revisar proposta do projeto Jarvis v3 antes da reunião',
    remind_at: daysAgo(3),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_003',
    status: 'sent', source: 'whatsapp', priority: 'high', sent: true,
  },
  // ── Passado – cancelado ───────────────────────────────────────────────────
  {
    message: 'Agendar dentista para segunda-feira',
    remind_at: daysAgo(4),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_004',
    status: 'cancelled', source: 'whatsapp', priority: 'low', sent: false,
  },
  // ── Passado – falhou ──────────────────────────────────────────────────────
  {
    message: 'Verificar backup semanal do servidor',
    remind_at: daysAgo(2),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_005',
    status: 'failed', source: 'whatsapp', priority: 'normal', sent: false,
  },
  // ── Pendentes – breve ────────────────────────────────────────────────────
  {
    message: 'Responder e-mail do Tiago sobre o prazo do DRM',
    remind_at: hoursAhead(2),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_006',
    status: 'pending', source: 'whatsapp', priority: 'high', sent: false,
  },
  {
    message: 'Comprar presente de aniversário para a Danielle',
    remind_at: hoursAhead(5),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_007',
    status: 'pending', source: 'whatsapp', priority: 'normal', sent: false,
  },
  // ── Pendentes – dias à frente ────────────────────────────────────────────
  {
    message: 'Preparar apresentação para reunião de diretoria',
    remind_at: daysAhead(2),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_008',
    status: 'pending', source: 'whatsapp', priority: 'high', sent: false,
  },
  {
    message: 'Pagar fatura do cartão corporativo',
    remind_at: daysAhead(5),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_009',
    status: 'pending', source: 'whatsapp', priority: 'normal', sent: false,
  },
  {
    message: 'Renovar assinatura do GitHub Copilot',
    remind_at: daysAhead(10),
    chat_id: JID, phone: PHONE, jid: JID, is_group: false,
    trigger_run_id: 'run_seed_010',
    status: 'pending', source: 'whatsapp', priority: 'low', sent: false,
    recurrence: 'monthly',
  },
];

async function seedReminders() {
  console.log('\n🌱 Inserindo lembretes de teste...');

  // Remove seeds anteriores deste script para idempotência
  await sql`DELETE FROM public.reminders WHERE trigger_run_id LIKE 'run_seed_%'`;

  let count = 0;
  for (const r of SEED_REMINDERS) {
    await sql`
      INSERT INTO public.reminders
        (message, remind_at, chat_id, phone, jid, is_group, trigger_run_id, status, source, priority, sent, recurrence)
      VALUES (
        ${r.message}, ${r.remind_at}::timestamptz, ${r.chat_id}, ${r.phone}, ${r.jid},
        ${r.is_group}, ${r.trigger_run_id}, ${r.status}, ${r.source}, ${r.priority},
        ${r.sent}, ${r.recurrence ?? null}
      )
    `;
    count++;
  }

  console.log(`  ✅ ${count} lembretes inseridos`);
}

// ─── 3. Teste de listagem ─────────────────────────────────────────────────────

function statusEmoji(status: string) {
  return { pending: '⏳', sent: '✅', cancelled: '🚫', failed: '❌' }[status] ?? '❓';
}

function priorityLabel(p: string) {
  return { high: '🔴 alta', normal: '🟡 normal', low: '🟢 baixa' }[p] ?? p;
}

async function testListing() {
  console.log('\n🔍 Testando listagem — lembretes PENDENTES (como o Jarvis responderia):');
  console.log('─────────────────────────────────────────────────────────────');

  const pending = await sql`
    SELECT * FROM public.reminders
    WHERE phone = ${PHONE} AND status = 'pending'
    ORDER BY remind_at ASC
  `;

  if (!pending.length) {
    console.log('Você não tem nenhum lembrete pendente.');
  } else {
    console.log(`Você tem ${pending.length} lembrete(s) pendente(s):\n`);
    pending.forEach((r, i) => {
      const when = new Date(r.remind_at).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long', day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
      const recur = r.recurrence ? ` 🔁 ${r.recurrence}` : '';
      console.log(`  ${i + 1}. ${statusEmoji(r.status)} *${r.message}*`);
      console.log(`     📅 ${when} | Prioridade: ${priorityLabel(r.priority)}${recur}`);
    });
  }

  console.log('\n📋 Histórico COMPLETO (todos os status):');
  console.log('─────────────────────────────────────────────────────────────');

  const all = await sql`
    SELECT * FROM public.reminders
    WHERE phone = ${PHONE}
    ORDER BY remind_at DESC
    LIMIT 20
  `;

  const byStatus = { pending: 0, sent: 0, cancelled: 0, failed: 0 } as Record<string, number>;
  all.forEach(r => { byStatus[r.status] = (byStatus[r.status] ?? 0) + 1; });

  console.log(`  Total: ${all.length} | ` +
    Object.entries(byStatus).map(([s, n]) => `${statusEmoji(s)} ${s}: ${n}`).join(' | '));

  console.log('\n  Todos os registros (mais recentes primeiro):');
  all.forEach(r => {
    const when = new Date(r.remind_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    console.log(`    ${statusEmoji(r.status)} [${when}] [${priorityLabel(r.priority)}] ${r.message}`);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🤖 Jarvis — Seed & Teste de Lembretes');
  console.log(`   Usuário: Gercino | Phone: ${PHONE}`);

  try {
    await applyMigration();
  } catch (e: any) {
    console.warn(`  ⚠️  Migração pulada (pode já estar aplicada): ${e.message}`);
  }

  await seedReminders();
  await testListing();

  console.log('\n✅ Tudo pronto! O Jarvis já consegue responder "quais são meus lembretes?".\n');
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
