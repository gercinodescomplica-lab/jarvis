import { CalendarPort } from '@jarvis/core/src/ports';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';

export class GraphCalendarAdapter implements CalendarPort {
    private client: Client;

    constructor() {
        const tenantId = process.env.AZURE_AD_TENANT_ID;
        const clientId = process.env.AZURE_AD_CLIENT_ID;
        const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;

        if (!tenantId || !clientId || !clientSecret) {
            throw new Error('Missing Microsoft Graph configuration');
        }

        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const authProvider = new TokenCredentialAuthenticationProvider(credential, {
            scopes: ['https://graph.microsoft.com/.default'],
        });

        this.client = Client.initWithMiddleware({ authProvider });
    }

    async getEventsForUsers(emails: string[]): Promise<any[]> {
        const allEvents: any[] = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Começa na meia noite do dia atual
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        for (const email of emails) {
            try {
                const result = await this.client
                    .api(`/users/${email}/calendarView`)
                    .query({
                        startDateTime: now.toISOString(),
                        endDateTime: nextWeek.toISOString(),
                        $select: 'subject,start,end,location,organizer',
                        $top: 20
                    })
                    .get();

                if (result.value) {
                    allEvents.push({
                        user: email,
                        events: result.value
                    });
                }
            } catch (error) {
                console.error(`Error fetching calendar for ${email}:`, error);
                allEvents.push({
                    user: email,
                    error: (error as Error).message
                });
            }
        }

        return allEvents;
    }
}
