import { generateProjectToken } from './jwt';

export interface NotionSearchResult {
    id: string;
    title: string;
    content: string;
    url: string;
    relevance?: number;
}

export async function searchNotion(query: string): Promise<NotionSearchResult[]> {
    const N8N_URL = process.env.N8N_WEBHOOK_URL;

    if (!N8N_URL) {
        console.warn("[Notion Search] N8N_WEBHOOK_URL not configured, skipping Notion search");
        return [];
    }

    try {
        const token = await generateProjectToken();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const res = await fetch(N8N_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            // Sending 'project' as key based on user feedback/screenshot
            body: JSON.stringify({ project: query }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
            console.error(`[Notion Search] Error ${res.status}: ${res.statusText}`);
            return [];
        }

        const rawText = await res.text();
        console.log(`[Notion Search] Raw Response for query '${query}':`, rawText);

        if (!rawText || rawText.trim() === '') {
            return [];
        }

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            console.error("[Notion Search] JSON Parse Error:", e, "Raw:", rawText);
            return [];
        }

        // 🟢 Robust Response Parsing
        let results: any[] = [];

        if (Array.isArray(data)) {
            // It's already a list of results
            results = data;
        } else if (data && typeof data === 'object') {
            // Single object response (ProjectData) - wrap it in array
            // If it has no 'id' or 'name', it might be an empty success { success: true }
            if (Object.keys(data).length > 0) {
                results = [data];
            }
        } else {
            console.warn("[Notion Search] Received invalid or empty data format");
            return [];
        }

        // Map any shape to NotionSearchResult for the chat context
        return results.map(item => ({
            id: item.id || 'unknown',
            title: item.name || item.title || 'Untitled',
            content: item.status
                ? `Status: ${item.status}. Urgency: ${item.urgencia || 'N/A'}. Risk: ${item.risco || 'N/A'}. Responsibles: ${item.responsavel || 'None'}.`
                : (item.content || JSON.stringify(item)),
            url: item.url || '',
            relevance: 1
        }));

    } catch (error) {
        console.error("[Notion Search] Fetch failed:", error);
        return [];
    }
}
