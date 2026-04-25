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

    // Destinatários: env var separada por vírgula, ou fallback para o grupo padrão
    const recipientsRaw = process.env.BIRTHDAY_RECIPIENTS || process.env.TARGET_WHATSAPP_GROUP || "";
    const recipients = recipientsRaw
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      console.warn("[Aniversários] Nenhum destinatário configurado (BIRTHDAY_RECIPIENTS).");
      return;
    }

    for (const dest of recipients) {
      await enviarAvisoWhatsApp(dest, mensagem);
      console.log(`[Aniversários] ✅ Mensagem enviada para ${dest}.`);
    }
  },
});
