export class GraphService {
    static async getUpcomingMeetings() {
        try {
            // Priority 1: Direct Graph Token (Manual/Dev)
            const graphToken = process.env.GRAPH_TOKEN;

            if (graphToken) {
                console.log(`[GraphService] Using direct GRAPH_TOKEN`);

                const now = new Date();
                const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

                // ISO strings
                const startDateTime = now.toISOString();
                const endDateTime = tomorrow.toISOString();

                const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$select=subject,start,end,location,webLink,isAllDay&$orderby=start/dateTime&$top=10`;

                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${graphToken}`,
                        "Content-Type": "application/json"
                    }
                });

                if (!response.ok) {
                    console.error(`[GraphService] Graph API Error: ${response.status} ${response.statusText}`);
                    const errorBody = await response.text();
                    console.error(`[GraphService] Details: ${errorBody}`);
                    return [];
                }

                const data = await response.json();

                if (data.value && Array.isArray(data.value)) {
                    return data.value.map((event: any) => ({
                        subject: event.subject || "Sem título",
                        start: event.start?.dateTime,
                        end: event.end?.dateTime,
                        location: event.location?.displayName || "Teams/Online",
                        url: event.webLink || "",
                        isAllDay: event.isAllDay || false
                    }));
                }
                return [];
            }

            // Priority 2: Webhook (Power Automate / N8N)
            const webhookUrl = process.env.CALENDAR_WEBHOOK_URL;
            if (webhookUrl) {
                console.log(`[GraphService] Fetching meetings from Webhook: ${webhookUrl}`);
                const response = await fetch(webhookUrl, {
                    method: "GET", // Or POST if your webhook requires it
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    console.error(`[GraphService] Webhook Error: ${response.status} ${response.statusText}`);
                    return [];
                }

                const data = await response.json();
                if (Array.isArray(data)) {
                    return data.map((event: any) => ({
                        subject: event.subject || event.subject || "Sem título",
                        start: event.start?.dateTime || event.start || "",
                        end: event.end?.dateTime || event.end || "",
                        location: event.location?.displayName || event.location || "Teams/Online",
                        url: event.webLink || event.url || "",
                        isAllDay: event.isAllDay || false
                    }));
                }
            }

            console.warn("[GraphService] No GRAPH_TOKEN or CALENDAR_WEBHOOK_URL configured.");
            return [];

        } catch (error) {
            console.error("[GraphService] Fetch Error:", error);
            return [];
        }
    }
}
