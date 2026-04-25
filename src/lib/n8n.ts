import { generateProjectToken } from './jwt';

export interface ProjectData {
    id: string;
    name: string;
    status: string;
    urgencia: string;
    risco: string;
    importancia: string;
    valorAgregado: string;
    roi: string;
    responsavel: string[];
    deadline: string | null;
    tipo: string;
    url: string;
    description?: string;
    details?: string;
}

export async function fetchProjectFromN8N(projectName: string): Promise<ProjectData | null> {
    const N8N_URL = process.env.N8N_WEBHOOK_URL;
    if (!N8N_URL) {
        console.error("N8N_WEBHOOK_URL is not defined in .env");
        return null;
    }

    const token = await generateProjectToken();

    try {
        // Determine URL - if mock is needed for dev without real N8N
        const isMock = N8N_URL.includes('example.com');

        if (isMock) {
            console.warn("[MOCK] N8N URL not set, returning mock data for:", projectName);
            // Simulate network delay
            await new Promise(r => setTimeout(r, 800));

            // Return mock based on name
            if (projectName.toLowerCase().includes('error')) return null;

            return {
                id: 'mock-123',
                name: projectName,
                status: 'Em Andamento',
                urgencia: 'Alta',
                risco: 'Médio',
                importancia: 'Estratégica',
                valorAgregado: 'Alto',
                roi: '150%',
                responsavel: ['João Silva', 'Ana Costa'],
                deadline: '2024-12-31',
                tipo: 'Desenvolvimento',
                url: 'https://notion.so/mock-project',
                description: 'Este projeto simula a integração com o N8N para fins de desenvolvimento.'
            };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const res = await fetch(N8N_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ project: projectName }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!res.ok) {
            console.error(`[N8N] Error ${res.status}: ${res.statusText}`);
            return null;
        }

        const rawText = await res.text();
        console.log(`[N8N] Raw Response for ${projectName}:`, rawText);

        if (!rawText || rawText.trim() === '') {
            console.warn("[N8N] Empty response received");
            return null;
        }

        const data = JSON.parse(rawText);

        // Validate shape roughly
        if (!data.name) return null;

        // Map fields to ensure robustness. N8N might return description under various keys.
        return {
            ...data,
            description: data.description || data.descricao || data.resumo || data.summary
        } as ProjectData;

    } catch (error) {
        console.error("[N8N] Fetch failed:", error);
        return null;
    }
}
