import { NextResponse } from 'next/server';
import { GraphService } from '@/lib/graph-service';
import { sendTelegramMessage } from '@/lib/telegram-sender';

export async function GET(req: Request) {
    try {
        // Security: In production, verify a "CRON_SECRET" header.
        // For this local/dev environment, we'll keep it open or check basics.
        const authHeader = req.headers.get('authorization');
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log("[CalendarBot] Checking for upcoming meetings...");

        // 1. Get meetings for the next 30 minutes
        const now = new Date();
        const future = new Date(now.getTime() + 30 * 60 * 1000); // +30 mins

        // We reuse GraphService list which fetches "Upcoming"
        // But GraphService.getUpcomingMeetings gets next 24h usually (or logic inside).
        // Let's modify GraphService slightly or filter results here.
        // GraphService currently fetches "startDateTime=now&endDateTime=tomorrow"
        const meetings = await GraphService.getUpcomingMeetings();

        const upcoming = meetings.filter((m: any) => {
            const start = new Date(m.start);
            // Verify if it starts between NOW and NOW+30min
            return start > now && start <= future;
        });

        if (upcoming.length === 0) {
            console.log("[CalendarBot] No meetings in the next 30 mins.");
            return NextResponse.json({ status: 'No meetings' });
        }

        // 2. Notify for key meetings
        // To avoid spamming on every cron tick (e.g. every 5 mins), 
        // we ideally need a "notified" cache. 
        // For this MVP version, we will assume the CRON runs every 30 minutes. 
        // OR we can filter strictly: "Starts in 10-15 minutes" to catch it only once.

        // Strict Filter: Starts between 10 and 20 mins from now.
        // This allows cron to run every 10 mins without double notifying.
        const windowStart = new Date(now.getTime() + 10 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 20 * 60 * 1000);

        const toNotify = meetings.filter((m: any) => {
            const start = new Date(m.start);
            return start >= windowStart && start <= windowEnd;
        });

        if (toNotify.length === 0) {
            return NextResponse.json({ status: 'Skipped (Time window)' });
        }

        for (const meeting of toNotify) {
            const timeStr = new Date(meeting.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const message = `🔔 *Próxima Reunião*\n\n**${meeting.subject}**\n🕒 ${timeStr}\n🔗 [Link](${meeting.url})`;

            await sendTelegramMessage(message);
        }

        return NextResponse.json({ sent: toNotify.length });

    } catch (error) {
        console.error("[CalendarBot] Error:", error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
