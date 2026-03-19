import { Client } from '@notionhq/client';

const notion = new Client({
    auth: process.env.NOTION_TOKEN, // Assuming NOTION_TOKEN is the variable name
});

const DATABASE_ID = process.env.NOTION_CALENDAR_DATABASE_ID;

export interface CalendarEvent {
    id: string; // Internal Outlook/Provider ID
    subject: string;
    start: string; // ISO String
    end: string;   // ISO String
    organizer?: string;
    link?: string;
    description?: string;
}

export class NotionCalendar {
    static async saveEvent(event: CalendarEvent) {
        if (!DATABASE_ID) {
            console.error("[NotionCalendar] NOTION_CALENDAR_DATABASE_ID is not set.");
            return false;
        }

        try {
            // Check for duplicate by querying the Database for the Event ID (if we decide to store it)
            // For now, let's assume we want to avoid exact duplicates based on start time and subject if ID isn't stored.
            // Better: Store the Outlook ID in a 'ProviderID' text column if possible.
            // Based on user prompt: "Add new record... if I search tomorrow..." implies we just append or upsert.
            // Let's search first.

            const existing = await notion.databases.query({
                database_id: DATABASE_ID,
                filter: {
                    property: "ProviderID", // We need to ask user to add this or use subject/date
                    rich_text: {
                        equals: event.id
                    }
                }
            });

            if (existing.results.length > 0) {
                console.log(`[NotionCalendar] Event ${event.id} already exists. Skipping.`);
                return true; // Already exists
            }

            await notion.pages.create({
                parent: { database_id: DATABASE_ID },
                properties: {
                    "Subject": {
                        title: [
                            { text: { content: event.subject } }
                        ]
                    },
                    "Start": {
                        date: {
                            start: event.start,
                            end: event.end
                        }
                    },
                    "Organizer": {
                        rich_text: [
                            { text: { content: event.organizer || "Unknown" } }
                        ]
                    },
                    "Link": {
                        url: event.link || null
                    },
                    "ProviderID": {
                        rich_text: [
                            { text: { content: event.id } }
                        ]
                    }
                }
            });

            console.log(`[NotionCalendar] Saved event: ${event.subject}`);
            return true;
        } catch (error) {
            console.error("[NotionCalendar] Error saving event:", error);
            return false;
        }
    }
}
