import { task } from "@trigger.dev/sdk/v3";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'LiciMonitor';

export interface ReminderPayload {
  senderPhone: string;   // numero do remetente (ex: "5511999999999")
  jid: string;           // remoteJid: group@g.us ou phone@s.whatsapp.net
  isGroup: boolean;
  reminder: string;      // texto do lembrete
}

export const reminderTask = task({
  id: "send-reminder",
  run: async (payload: ReminderPayload, { ctx }) => {
    const { senderPhone, jid, isGroup, reminder } = payload;

    const cleanPhone = senderPhone.replace(/\D/g, '');
    const senderJid = `${cleanPhone}@s.whatsapp.net`;

    let text: string;
    const body: Record<string, unknown> = {
      number: jid,
      linkPreview: false,
    };

    if (isGroup) {
      text = `@${cleanPhone} 🔔 *Lembrete!*\n\n${reminder}`;
      body.mentioned = [senderJid];
    } else {
      text = `🔔 *Lembrete!*\n\n${reminder}`;
    }

    body.text = text;

    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_TOKEN || '',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error(`[Reminder] Falha ao enviar para ${jid}:`, err);

      // Mark as failed in DB before throwing so the status is accurate
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const db = createClient(
          `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
          process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        );
        await db.from('reminders').update({ status: 'failed' }).eq('trigger_run_id', ctx.run.id);
      } catch { /* non-critical */ }

      throw new Error(`Evolution API error: ${err}`);
    }

    console.log(`[Reminder] Lembrete enviado para ${jid} (sender: ${cleanPhone})`);

    // Mark as sent in DB
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const db = createClient(
        `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
        process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      );
      await db.from('reminders')
        .update({ sent: true, status: 'sent' })
        .eq('trigger_run_id', ctx.run.id);
    } catch (e) {
      console.warn('[Reminder] Falha ao marcar como enviado no DB (não crítico):', e);
    }
  },
});
