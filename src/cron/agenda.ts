import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'Jarvis';

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

    // Busca apenas 2 dias (hoje + amanhã) e filtra só amanhã
    const results = await adapter.getEventsForUsers(targetEmails, 2);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const tomorrowDateStr = tomorrow.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
    });

    const tomorrowDayStr = tomorrow.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
    });

    let report = `*🗓️ AGENDA DE AMANHÃ: TIAGO LUZ*\n_${tomorrowDateStr}_\n\n`;

    results.forEach(r => {
      if (r.error) {
        report += `❌ Erro ao ler calendário.\n`;
        return;
      }

      // Filtra apenas eventos de amanhã
      const tomorrowEvents = (r.events || []).filter((e: any) => {
        const dt = new Date(e.start.dateTime);
        const dtStr = dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
        return dtStr === tomorrowDayStr;
      });

      if (tomorrowEvents.length === 0) {
        report += `✅ Nenhuma reunião programada para amanhã.\n`;
        return;
      }

      const sortedEvents = tomorrowEvents.sort((a: any, b: any) =>
        new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
      );

      sortedEvents.forEach((e: any) => {
        const dt = new Date(e.start.dateTime);
        const time = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

        let loc = e.location?.displayName || '';
        if (loc.includes('Teams')) loc = 'Microsoft Teams';
        if (loc.includes('Google') || loc.includes('Meet')) loc = 'Google Meet';

        const locAppend = loc ? ` (${loc})` : '';
        report += `• ${time} - ${e.subject}${locAppend}\n`;
      });
    });

    return report;
  } catch (error) {
    console.error("[CRON] Erro ao buscar agenda:", error);
    return "*❌ Jarvis Error:* Não consegui buscar a agenda do Tiago para o resumo de hoje.";
  }
}
