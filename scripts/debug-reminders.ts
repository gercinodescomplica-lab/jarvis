import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  // 1. Mostra tudo que está na tabela
  const all = await sql`
    SELECT phone, jid, status, message, remind_at
    FROM public.reminders
    ORDER BY remind_at DESC
    LIMIT 20
  `;

  console.log('\n=== Todos os registros na tabela reminders ===');
  if (!all.length) {
    console.log('(tabela vazia)');
  } else {
    all.forEach(r => console.log(
      `phone=${r.phone ?? 'NULL'} | status=${r.status} | ${String(r.message).slice(0, 45)}`
    ));
  }

  // 2. Simula exatamente o que listRemindersTool faz
  // phone recebido pelo tool = o jid completo que vem do webhook
  const jidFromWebhook = '5511949633602@s.whatsapp.net';
  const digits = jidFromWebhook.replace(/\D/g, '');
  const cleanPhone = digits.startsWith('55') ? digits : `55${digits}`;

  console.log(`\n=== Simulando listRemindersTool ===`);
  console.log(`  JID entrada : ${jidFromWebhook}`);
  console.log(`  cleanPhone  : ${cleanPhone}`);

  const pending = await sql`
    SELECT * FROM public.reminders
    WHERE phone = ${cleanPhone} AND status = 'pending'
    ORDER BY remind_at ASC
  `;

  console.log(`\n  Pendentes encontrados: ${pending.length}`);
  pending.forEach((r, i) => {
    const when = new Date(r.remind_at).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    console.log(`  ${i + 1}. [${when}] ${r.message}`);
  });

  // 3. Testa também sem o DDI, caso esteja gravado assim
  const pendingNoDdi = await sql`
    SELECT count(*) as n FROM public.reminders
    WHERE phone = ${'11949633602'} AND status = 'pending'
  `;
  console.log(`\n  Registros com phone=11949633602 (sem DDI): ${pendingNoDdi[0].n}`);

  // 4. Verifica o que o Vercel tem deployado — checa a URL da API
  console.log('\n=== Checando se o código deployado está atualizado ===');
  try {
    const res = await fetch('https://jarvis-v2.vercel.app/api/admin/reminders', {
      headers: { Authorization: `Bearer ${process.env.ADMIN_SECRET || ''}` }
    });
    const body = await res.text();
    console.log(`  Status HTTP: ${res.status}`);
    // Se retornar array JSON, o novo código está deployado
    try {
      const json = JSON.parse(body);
      if (Array.isArray(json)) {
        console.log(`  ✅ Novo código detectado — retornou array com ${json.length} registros`);
      } else {
        console.log(`  ⚠️  Resposta inesperada:`, body.slice(0, 200));
      }
    } catch {
      console.log(`  Resposta raw:`, body.slice(0, 200));
    }
  } catch (e: any) {
    console.log(`  (não foi possível checar Vercel: ${e.message})`);
  }

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
