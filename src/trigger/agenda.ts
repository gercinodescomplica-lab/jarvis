import { schedules } from "@trigger.dev/sdk/v3";
import { getAgendaSemana, enviarAvisoWhatsApp } from "../cron/agenda";

export const sendAgendaTask = schedules.task({
  id: "enviar-agenda-diaria",
  cron: "0 0 * * *", // 00h UTC = 21h BRT (UTC-3)
  run: async () => {
    console.log("[Agenda] ⏰ Iniciando envio de agenda do Tiago...");

    // Descobre qual é "amanhã" no horário de Brasília
    const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const tomorrow = new Date(nowBRT);
    tomorrow.setDate(nowBRT.getDate() + 1);
    const tomorrowDow = tomorrow.getDay(); // 0=Dom, 1=Seg ... 6=Sab

    const isTomorrowWeekend = tomorrowDow === 0 || tomorrowDow === 6; // Domingo ou Sábado

    const { relatorio, hasEvents } = await getAgendaSemana();

    // Regra do fim de semana: sexta → sábado e sábado → domingo só envia se tiver eventos
    if (isTomorrowWeekend && !hasEvents) {
      console.log(`[Agenda] 🔕 Amanhã é fim de semana sem eventos — silêncio.`);
      return;
    }

    const primary = process.env.TARGET_WHATSAPP_GROUP || "5511949633602";
    const dani = "5516981317391";
    const grupoGe = "120363420097358880@g.us";
    const extra = (process.env.AGENDA_EXTRA_RECIPIENTS || "")
      .split(",")
      .map(n => n.trim())
      .filter(Boolean);

    const recipients = [...new Set([primary, dani, grupoGe, ...extra])];

    for (const dest of recipients) {
      await enviarAvisoWhatsApp(dest, relatorio);
      console.log(`[Agenda] ✅ Agenda enviada para ${dest}.`);
    }
  },
});
