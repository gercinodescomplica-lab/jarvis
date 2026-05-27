import { schedules } from "@trigger.dev/sdk/v3";
import { getAgendaSemana, getAgendaUsuario, enviarAvisoWhatsApp } from "../cron/agenda";

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

    const primary = process.env.TARGET_WHATSAPP_GROUP || "5511949633602";
    const dani = "5516981317391";
    const grupoGe = "120363420097358880@g.us";
    const extra = (process.env.AGENDA_EXTRA_RECIPIENTS || "")
      .split(",")
      .map(n => n.trim())
      .filter(Boolean);

    const recipients = [...new Set([primary, dani, grupoGe, ...extra])];

    // Regra do fim de semana: só envia para o Tiago se tiver eventos
    if (!isTomorrowWeekend || hasEvents) {
      for (const dest of recipients) {
        try {
          await enviarAvisoWhatsApp(dest, relatorio);
          console.log(`[Agenda] ✅ Agenda enviada para ${dest}.`);
        } catch (err) {
          console.error(`[Agenda] ❌ Falha ao enviar para ${dest}:`, err);
        }
      }
    } else {
      console.log(`[Agenda] 🔕 Amanhã é fim de semana sem eventos — silêncio para o Tiago.`);
    }

    // Agenda da Marcella Batista enviada direto para o número dela
    console.log("[Agenda] ⏰ Buscando agenda da Marcella...");
    const { relatorio: relatorioMarcella, hasEvents: hasEventsMarcella } = await getAgendaUsuario(
      "marcellabatista@prodam.sp.gov.br",
      "Marcella Batista",
    );

    if (isTomorrowWeekend && !hasEventsMarcella) {
      console.log("[Agenda] 🔕 Marcella: amanhã é fim de semana sem eventos — silêncio.");
    } else {
      try {
        await enviarAvisoWhatsApp("5511961117448", relatorioMarcella);
        console.log("[Agenda] ✅ Agenda da Marcella enviada para 5511961117448.");
      } catch (err) {
        console.error("[Agenda] ❌ Falha ao enviar agenda da Marcella:", err);
      }
    }
  },
});
