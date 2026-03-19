import { GraphCalendarAdapter } from './ms-graph';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function test() {
    console.log('Testing Graph Calendar Adapter...');
    try {
        const adapter = new GraphCalendarAdapter();
        const emails = process.env.GRAPH_USER_EMAILS?.split(',') || [];

        console.log(`Users to fetch: ${emails.join(', ')}`);

        const results = await adapter.getEventsForUsers(emails);

        results.forEach(res => {
            if (res.error) {
                console.error(`- [${res.user}] Error: ${res.error}`);
            } else {
                console.log(`- [${res.user}] Found ${res.events.length} events`);
                res.events.forEach((event: any) => {
                    console.log(`  * ${event.subject} (${event.start.dateTime} - ${event.end.dateTime})`);
                });
            }
        });
    } catch (error) {
        console.error('Test failed:', error);
    }
}

test();
