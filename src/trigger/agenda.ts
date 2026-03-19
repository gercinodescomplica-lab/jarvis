import { schedules } from "@trigger.dev/sdk/v3";
import { getAgendaSemana, enviarAvisoWhatsApp } from "../cron/agenda";

export const sendAgendaTask = schedules.task({
  id: "enviar-agenda-diaria",
  cron: "0 1 * * *", // 01h UTC = 22h BRT (UTC-3)
  run: async (payload, { ctx }) => {
    console.log("[Trigger.dev] ⏰ Iniciando envio de agenda do Tiago...");
    
    // Obtém o grupo da variável de ambiente, se não achar cai no número padrão
    const defaultNumber = "5511949633602";
    const targetGroupOrNumber = process.env.TARGET_WHATSAPP_GROUP || defaultNumber;
    
    try {
      const relatorio = await getAgendaSemana();
      await enviarAvisoWhatsApp(targetGroupOrNumber, relatorio);
      console.log(`[Trigger.dev] ✅ Resumo de agenda enviado para ${targetGroupOrNumber} com sucesso.`);
    } catch (error) {
      console.error("[Trigger.dev] ❌ Erro ao enviar agenda:", error);
      throw error;
    }
  },
});
