import { NextRequest, NextResponse } from 'next/server';
import { CalendarDB } from '@/lib/calendar-db';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const startParam = searchParams.get('start');
        const endParam = searchParams.get('end');

        // Default to "today" and "tomorrow" if not specified, 
        // or just return everything if user wants. 
        // Let's implement a default window of -1 day to +7 days if nothing provided to be safe.
        let start = new Date();
        start.setHours(0, 0, 0, 0); // Start of today

        let end = new Date();
        end.setDate(end.getDate() + 7); // Next 7 days
        end.setHours(23, 59, 59, 999);

        if (startParam) {
            start = new Date(startParam);
        }
        if (endParam) {
            end = new Date(endParam);
        }

        const events = await CalendarDB.getEvents(start, end);

        // Sort events by start time
        events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        return NextResponse.json({
            range: {
                start: start.toISOString(),
                end: end.toISOString()
            },
            count: events.length,
            events: events
        });
    } catch (error) {
        console.error("[API] /api/calendar error:", error);
        return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 });
    }
}

// Keeping POST for backward compatibility or if reused, but user asked for query route.
// The original POST was fetching from Graph. We can leave it or remove it.
// Given the new direction, I'll replace the file content entirely with the GET handler 
// as the "GraphService" might be deprecated in favor of this local webhook approach.
// However, to be safe, I will NOT export a POST unless requested.
