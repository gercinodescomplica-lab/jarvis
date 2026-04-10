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

    async getEventsForUsers(emails: string[], days: number = 7): Promise<any[]> {
        const allEvents: any[] = [];

        // Meia-noite no horário de Brasília (UTC-3)
        const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        nowBRT.setHours(0, 0, 0, 0);
        const startISO = new Date(nowBRT.getTime() + 3 * 60 * 60 * 1000).toISOString(); // converte de volta pra UTC

        const endBRT = new Date(nowBRT);
        endBRT.setDate(endBRT.getDate() + days);
        const endISO = new Date(endBRT.getTime() + 3 * 60 * 60 * 1000).toISOString();

        for (const email of emails) {
            try {
                const result = await this.client
                    .api(`/users/${email}/calendarView`)
                    .header('Prefer', 'outlook.timezone="E. South America Standard Time"')
                    .query({
                        startDateTime: startISO,
                        endDateTime: endISO,
                        $select: 'subject,start,end,location,organizer,attendees',
                        $top: 999
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
