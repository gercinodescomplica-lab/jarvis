import { CalendarPort, EmailPort } from '@jarvis/core/src/ports';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';

export class GraphCalendarAdapter implements CalendarPort, EmailPort {
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

    async getEmailsForUser(userEmail: string, options: { fromSenders?: string[]; top?: number; unreadOnly?: boolean } = {}): Promise<any[]> {
        const { fromSenders = [], top = 25, unreadOnly = false } = options;

        const filters: string[] = [];
        if (unreadOnly) filters.push('isRead eq false');
        if (fromSenders.length > 0) {
            const senderFilters = fromSenders.map(s => `from/emailAddress/address eq '${s}'`).join(' or ');
            filters.push(`(${senderFilters})`);
        }

        try {
            const query: Record<string, any> = {
                $select: 'id,subject,from,receivedDateTime,bodyPreview,isRead',
                $top: top,
            };
            if (filters.length > 0) {
                // $orderby cannot be combined with $filter on from/* fields (InefficientFilter)
                query['$filter'] = filters.join(' and ');
            } else {
                query['$orderby'] = 'receivedDateTime desc';
            }
            const result = await this.client
                .api(`/users/${userEmail}/mailFolders/inbox/messages`)
                .query(query)
                .get();
            const emails = result.value || [];
            if (filters.length > 0) {
                emails.sort((a: any, b: any) =>
                    new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime()
                );
            }
            return emails;
        } catch (error) {
            console.error(`Error fetching emails for ${userEmail}:`, error);
            throw error;
        }
    }

    // Retorna emails novos desde a última chamada usando Delta Query (Strategy B).
    // deltaLink = null na primeira execução (inicializa o estado, não retorna emails).
    // Nas execuções seguintes, retorna apenas o que mudou desde o último delta.
    async getEmailsDelta(mailbox: string, deltaLink?: string): Promise<{ emails: any[]; nextDeltaLink: string }> {
        const emails: any[] = [];
        let nextDeltaLink = '';

        // Delta links são URLs completas — extrai o caminho relativo para o SDK
        const toRelativePath = (url: string) =>
            url.replace('https://graph.microsoft.com/v1.0', '');

        const initialPath = `/users/${mailbox}/mailFolders/inbox/messages/delta`;
        let currentPath = deltaLink ? toRelativePath(deltaLink) : initialPath;
        const isFirstRun = !deltaLink;

        while (currentPath) {
            const req = this.client.api(currentPath);

            // Na primeira chamada sem delta, define os campos desejados
            if (!deltaLink) {
                req.query({
                    $select: 'subject,from,receivedDateTime,bodyPreview,isRead,body',
                    $top: 50,
                });
            }

            const result = await req.get();

            // Na primeira execução apenas percorremos as páginas para obter o deltaLink
            // sem acumular emails (queremos monitorar apenas emails futuros)
            if (!isFirstRun) {
                emails.push(...(result.value || []));
            }

            if (result['@odata.nextLink']) {
                currentPath = toRelativePath(result['@odata.nextLink']);
                deltaLink = undefined; // próximas páginas já têm os params no link
            } else if (result['@odata.deltaLink']) {
                nextDeltaLink = result['@odata.deltaLink'];
                break;
            } else {
                break;
            }
        }

        return { emails, nextDeltaLink };
    }

    async getFullEmail(mailbox: string, messageId: string): Promise<any> {
        try {
            const result = await this.client
                .api(`/users/${mailbox}/messages/${messageId}`)
                .query({
                    $select: 'subject,from,receivedDateTime,bodyPreview,isRead,body'
                })
                .get();
            return result;
        } catch (error) {
            console.error(`Error fetching full email ${messageId}:`, error);
            throw error;
        }
    }
}
