import { NextResponse } from 'next/server';
import { GraphService } from '@/lib/graph-service';
import { sendTelegramMessage } from '@/lib/telegram-sender';
import { enviarAvisoWhatsApp } from '@/lib/evolution-client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('calendar-bot');

export async function GET(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        logger.info('Verificando reuniões próximas...');

        const now = new Date();
        const windowStart = new Date(now.getTime() + 10 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 20 * 60 * 1000);

        const meetings = await GraphService.getUpcomingMeetings();

        const toNotify = meetings.filter((m: any) => {
            const start = new Date(m.start);
            return start >= windowStart && start <= windowEnd;
        });

        if (toNotify.length === 0) {
            logger.info('Nenhuma reunião na janela de 10-20 min.');
            return NextResponse.json({ status: 'Skipped (Time window)' });
        }

        // Telefones do WhatsApp para notificar (comma-separated em CALENDAR_NOTIFY_PHONES)
        const whatsappPhones = (process.env.CALENDAR_NOTIFY_PHONES || '')
            .split(',')
            .map(p => p.trim())
            .filter(Boolean);

        for (const meeting of toNotify) {
            const start = new Date(meeting.start);
            const minutesUntil = Math.round((start.getTime() - now.getTime()) / 60000);
            const timeStr = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const location = meeting.location || 'Online';

            let message = `🔔 *Reunião em breve!*\n\n*${meeting.subject}*\n🕒 ${timeStr} (em ${minutesUntil} min)\n📍 ${location}`;
            if (meeting.url) {
                message += `\n🔗 [Entrar na reunião](${meeting.url})`;
            }

            // Telegram
            await sendTelegramMessage(message);
            logger.info(`Notificação Telegram enviada: "${meeting.subject}"`);

            // WhatsApp
            for (const phone of whatsappPhones) {
                await enviarAvisoWhatsApp(phone, message);
                logger.info(`Notificação WhatsApp enviada para ${phone}: "${meeting.subject}"`);
            }
        }

        return NextResponse.json({ sent: toNotify.length });

    } catch (error) {
        logger.error('Erro no calendar bot', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
