import cron from 'node-cron';
import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';

// Configuração Evolution
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'LiciMonitor';

const MEU_NUMERO = '5511949633602'; // Número do usuário que vai receber o job

export async function enviarAvisoWhatsApp(telefone: string, mensagemTexto: string) {
  const payload = { number: telefone, text: mensagemTexto, linkPreview: false };
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_TOKEN || ''
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`[CRON] Erro: ${await response.text()}`);
    console.log(`[CRON] Resumo enviado com sucesso para ${telefone}!`);
  } catch (error) {
    console.error(`[CRON] Falha no envio:`, error);
  }
}

export async function getAgendaSemana() {
  const adapter = new GraphCalendarAdapter();
  try {
    const targetEmails = ['tiagoluz@prodam.sp.gov.br'];

    // Obter data de hoje (Segunda) até Sexta
    const now = new Date();
    const friday = new Date(now);
    friday.setDate(now.getDate() + 4); // Vai até Sexta

    // Usa a mesma abstração base da Graph API (que puxa até 7 dias)
    const results = await adapter.getEventsForUsers(targetEmails);

    let report = `*🗓️ RESUMO DA AGENDA: TIAGO LUZ*\n_Para esta semana (Diário as 18h)_\n\n`;

    results.forEach(r => {
      if (r.error) {
        report += `❌ Erro ao ler calendário.\n`;
      } else if (!r.events || r.events.length === 0) {
        report += `✅ Nenhuma reunião programada.\n`;
      } else {
        // 1. Order chronological
        const sortedEvents = r.events.sort((a: any, b: any) =>
          new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
        );

        // 2. Group by Day
        const grouped: Record<string, string[]> = {};

        sortedEvents.forEach((e: any) => {
          const dt = new Date(e.start.dateTime);

          let diaSemana = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });
          diaSemana = diaSemana.split('-')[0]; // Pega Segunda invés de Segunda-feira
          diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

          const diaMes = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
          const key = `• *${diaSemana}, ${diaMes}*`;

          if (!grouped[key]) grouped[key] = [];

          const time = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

          let loc = e.location?.displayName || '';
          if (loc.includes('Teams')) loc = 'Microsoft Teams';
          if (loc.includes('Google') || loc.includes('Meet')) loc = 'Google Meet';

          const locAppend = loc ? ` (${loc})` : '';
          grouped[key].push(`${time} - ${e.subject}${locAppend}`);
        });

        // 3. Build String
        for (const [dayKey, eventsArray] of Object.entries(grouped)) {
          report += `\n${dayKey}\n${eventsArray.join('\n')}\n`;
        }
      }
    });

    return report;
  } catch (error) {
    console.error("[CRON] Erro ao buscar agenda:", error);
    return "*❌ Jarvis Error:* Não consegui buscar a agenda do Tiago para o resumo de hoje.";
  }
}
// node-cron removido a favor do trigger.dev
