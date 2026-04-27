import { schedules } from "@trigger.dev/sdk/v3";
import { getAniversariantesHoje, formatarMensagemAniversario } from "../cron/aniversarios";
import { enviarAvisoWhatsApp } from "../cron/agenda";

export const aniversariosTask = schedules.task({
  id: "verificar-aniversarios-diarios",
  cron: "0 12 * * *", // 12h UTC = 09h BRT (UTC-3)
  run: async () => {
    console.log("[Aniversários] ⏰ Verificando aniversariantes do dia...");

    const aniversariantes = await getAniversariantesHoje();

    if (aniversariantes.length === 0) {
      console.log("[Aniversários] Nenhum aniversariante hoje. Nada a enviar.");
      return;
    }

    const mensagem = formatarMensagemAniversario(aniversariantes);
    console.log("[Aniversários] Mensagem gerada:\n", mensagem);

    // Busca destinatários ativos do Supabase
    let recipients: string[] = [];
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data } = await supabase
        .from('birthday_recipients')
        .select('whatsapp_id')
        .eq('active', true);
      recipients = (data ?? []).map((r: { whatsapp_id: string }) => r.whatsapp_id);
    } catch (e) {
      console.warn('[Aniversários] Falha ao buscar do Supabase, usando env var:', e);
    }

    // Fallback: env var (compatibilidade)
    if (recipients.length === 0) {
      const raw = process.env.BIRTHDAY_RECIPIENTS || process.env.TARGET_WHATSAPP_GROUP || "";
      recipients = raw.split(",").map(r => r.trim()).filter(Boolean);
    }

    if (recipients.length === 0) {
      console.warn("[Aniversários] Nenhum destinatário configurado.");
      return;
    }

    for (const dest of recipients) {
      await enviarAvisoWhatsApp(dest, mensagem);
      console.log(`[Aniversários] ✅ Mensagem enviada para ${dest}.`);
    }
  },
});
