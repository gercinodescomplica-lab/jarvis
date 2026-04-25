import { NextRequest, NextResponse } from 'next/server';
import { CalendarDB, CalendarEvent } from '@/lib/calendar-db';
import { sendTelegramMessage } from '@/lib/telegram-sender';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        console.log("----- [WEBHOOK] Calendar Data Received -----");
        console.dir(body, { depth: null, colors: true });

        let events: CalendarEvent[] = [];

        if (Array.isArray(body)) {
            events = body;
        } else if (body.events && Array.isArray(body.events)) {
            events = body.events;
        } else if (body.value && Array.isArray(body.value)) {
            // Microsoft Graph often returns { value: [...] }
            events = body.value;
        } else {
            // Fallback: treat body as single event if it looks like one
            events = [body];
        }
        let savedCount = 0;

        for (const calendarEvent of events) {
            const success = await CalendarDB.saveEvent(calendarEvent);
            if (success) savedCount++;
        }

        console.log(`[WEBHOOK] Processed ${events.length} events. Saved: ${savedCount}`);
        console.log("--------------------------------------------");

        if (savedCount > 0) {
            // User requested: "Send events from Today until End of Week"
            const now = new Date();
            const endOfWeek = new Date();
            // Set to next Sunday (or Friday? Let's assume Sunday for full week view)
            const day = now.getDay(); // 0 (Sun) to 6 (Sat)
            const diff = 7 - day;
            endOfWeek.setDate(now.getDate() + diff);
            endOfWeek.setHours(23, 59, 59, 999);

            const weeklyEvents = await CalendarDB.getEvents(now, endOfWeek);

            if (weeklyEvents.length > 0) {
                let msg = `📅 *Agenda da Semana* (Atualizada)\n\n`;

                // Group by Day
                const grouped: Record<string, typeof weeklyEvents> = {};
                weeklyEvents.forEach(evt => {
                    const dateKey = new Date(evt.start).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(evt);
                });

                Object.keys(grouped).forEach(date => {
                    msg += `🔻 *${date.toUpperCase()}*\n`;
                    grouped[date].forEach(evt => {
                        const time = new Date(evt.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        msg += `   • ${time} - ${evt.subject}\n`;
                    });
                    msg += `\n`;
                });

                await sendTelegramMessage(msg);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${events.length} events. Saved ${savedCount} new/updated.`,
            receivedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("[WEBHOOK] Error processing request:", error);
        return NextResponse.json(
            { success: false, error: "Invalid JSON or internal error" },
            { status: 400 }
        );
    }
}
