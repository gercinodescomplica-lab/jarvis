import { schedules } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'LiciMonitor';

async function sendWhatsApp(phone: string, text: string) {
  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_TOKEN || '' },
    body: JSON.stringify({ number: phone, text, linkPreview: false }),
  });
  if (!res.ok) throw new Error(`Evolution error ${res.status}: ${await res.text()}`);
}

export const grcWeeklyCollectionTask = schedules.task({
  id: "grc-weekly-collection",
  // Toda sexta-feira às 11h BRT (UTC-3 = 14h UTC)
  cron: "0 14 * * 5",
  run: async () => {
    console.log("[GRC Weekly] Iniciando coleta semanal de gerentes...");

    const db = createClient(
      `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );

    const { data: managers, error } = await db
      .from('grc_users')
      .select('phone, display_name, manager_id')
      .eq('active', true);

    if (error) {
      console.error("[GRC Weekly] Erro ao buscar gerentes:", error.message);
      throw error;
    }

    if (!managers || managers.length === 0) {
      console.log("[GRC Weekly] Nenhum gerente ativo encontrado.");
      return;
    }

    console.log(`[GRC Weekly] Enviando para ${managers.length} gerente(s)...`);

    const results = await Promise.allSettled(
      managers.map(async (manager) => {
        const firstName = manager.display_name.split(' ')[0];
        const message =
          `Oi ${firstName}! 👋 É sexta — hora de registrar a semana no dashboard.\n\n` +
          `Me conta:\n` +
          `• Teve alguma *visita* essa semana?\n` +
          `• Algum *CX novo* (problema ou risco de cliente)?\n` +
          `• Atualização em algum *projeto* do pipeline?\n\n` +
          `Pode me contar tudo de uma vez ou um por um, como preferir. 😊`;

        const phone = /^55/.test(manager.phone) ? manager.phone : `55${manager.phone}`;
        await sendWhatsApp(phone, message);
        console.log(`[GRC Weekly] ✅ Mensagem enviada para ${manager.display_name} (${manager.phone})`);
      })
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.error(`[GRC Weekly] ${failed.length} envio(s) falharam:`, failed);
    }

    console.log(`[GRC Weekly] Concluído: ${results.length - failed.length}/${results.length} enviados.`);
  },
});
