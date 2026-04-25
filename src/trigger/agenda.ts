import { schedules } from "@trigger.dev/sdk/v3";
import { getAgendaSemana, enviarAvisoWhatsApp } from "../cron/agenda";

export const sendAgendaTask = schedules.task({
  id: "enviar-agenda-diaria",
  cron: "0 0 * * *", // 00h UTC = 21h BRT (UTC-3)
  run: async (payload, { ctx }) => {
    console.log("[Trigger.dev] ⏰ Iniciando envio de agenda do Tiago...");

    // Lista de destinatários: número principal + Dani + extras via env var
    const primary = process.env.TARGET_WHATSAPP_GROUP || "5511949633602";
    const dani = "5516981317391"; // Danielle Oliveira
    const grupoGe = "120363420097358880@g.us"; // Grupo Ge
    const extra = (process.env.AGENDA_EXTRA_RECIPIENTS || "")
      .split(",")
      .map(n => n.trim())
      .filter(Boolean);

    const recipients = [...new Set([primary, dani, grupoGe, ...extra])];

    try {
      const relatorio = await getAgendaSemana();

      for (const dest of recipients) {
        await enviarAvisoWhatsApp(dest, relatorio);
        console.log(`[Trigger.dev] ✅ Agenda enviada para ${dest}.`);
      }
    } catch (error) {
      console.error("[Trigger.dev] ❌ Erro ao enviar agenda:", error);
      throw error;
    }
  },
});
