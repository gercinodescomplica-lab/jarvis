import fs from 'fs';
import path from 'path';

export interface CalendarEvent {
    id: string; // Internal Outlook/Provider ID
    subject: string;
    start: string; // ISO String
    end: string;   // ISO String
    organizer?: string;
    link?: string;
    description?: string;
    attendees?: string | string[];
    receivedAt?: string;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'calendar-events.json');

export class CalendarDB {
    private static ensureDb() {
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify({ events: [] }, null, 2));
        }
    }

    private static readDb(): { events: CalendarEvent[] } {
        this.ensureDb();
        try {
            const content = fs.readFileSync(DB_FILE, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.error("[CalendarDB] Read error, resetting DB:", error);
            return { events: [] };
        }
    }

    private static writeDb(data: { events: CalendarEvent[] }) {
        this.ensureDb();
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    }

    static async saveEvent(event: CalendarEvent) {
        const db = this.readDb();

        // Upsert based on ID
        const index = db.events.findIndex(e => e.id === event.id);

        if (index !== -1) {
            db.events[index] = { ...db.events[index], ...event, receivedAt: new Date().toISOString() };
        } else {
            db.events.push({ ...event, receivedAt: new Date().toISOString() });
        }

        this.writeDb(db);
        console.log(`[CalendarDB] Saved/Updated event: ${event.subject}`);
        return true;
    }

    // Get events for a specific date (local time YYYY-MM-DD comparison) or range
    static async getEvents(start: Date, end: Date) {
        const db = this.readDb();
        return db.events.filter(e => {
            const eventStart = new Date(e.start);
            return eventStart >= start && eventStart <= end;
        });
    }

    static async getAllEvents() {
        const db = this.readDb();
        return db.events;
    }
}
