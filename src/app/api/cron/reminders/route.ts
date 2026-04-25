import { NextResponse } from 'next/server';
import { ReminderService } from '@/lib/reminder-service';
import { sendTelegramMessage } from '@/lib/telegram-sender';

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const due = await ReminderService.getDue();

        for (const reminder of due) {
            await sendTelegramMessage(`⏰ *Lembrete:* ${reminder.message}`, reminder.chatId);
            await ReminderService.markSent(reminder.id);
        }

        console.log(`[Reminders Cron] Sent ${due.length} reminder(s).`);
        return NextResponse.json({ sent: due.length });
    } catch (error) {
        console.error('[Reminders Cron] Error:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
