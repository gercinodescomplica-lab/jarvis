import { LlmPort, VectorPort, SttPort } from '@jarvis/core/src/ports';

export class OpenAIAdapter implements LlmPort, VectorPort, SttPort {

    constructor() {
        // Direct fetch implementation doesn't need a client instance
    }

    // LLM Port
    async generateResponse(systemPrompt: string, userMessage: string, context?: string): Promise<string> {
        try {
            const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://oia-gercinotest.openai.azure.com/";
            const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4.1-mini";
            const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview";
            const apiKey = process.env.AZURE_OPENAI_API_KEY;

            const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

            console.log(`[JarvisAdapter] Fetching: ${url}`);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": apiKey || ""
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: systemPrompt + (context ? `\nContext: ${context}` : "") },
                        { role: "user", content: userMessage },
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                console.error("Azure Fetch Error:", errorData);
                throw new Error(`Azure API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content || "";
        } catch (error) {
            console.error("OpenAI Fetch Adapter Error:", error);
            throw error;
        }
    }

    async extractIntent(userMessage: string): Promise<{ intent: string; entities: any }> {
        // Mock intent extraction
        const lower = userMessage.toLowerCase();
        if (lower.includes('criar projeto') || lower.includes('novo projeto')) {
            return { intent: 'create_project', entities: { name: userMessage.replace(/criar projeto|novo projeto/gi, '').trim() } };
        }
        if (lower.includes('criar tarefa') || lower.includes('nova tarefa')) {
            return { intent: 'create_task', entities: { title: userMessage.replace(/criar tarefa|nova tarefa/gi, '').trim() } };
        }
        if (lower.includes('status')) {
            return { intent: 'get_status', entities: { projectName: userMessage.replace(/status/gi, '').trim() } };
        }
        return { intent: 'smalltalk', entities: {} };
    }

    // Vector Port
    async search(query: string, limit?: number): Promise<string[]> {
        // Mock vector search
        return [`Contexto relevante simulado para: ${query}`];
    }

    async addEmbedding(content: string, metadata?: any): Promise<void> {
        console.log('[OpenAI] Adding embedding for:', content);
    }

    // STT Port
    async transcribe(audio: Blob | Buffer): Promise<string> {
        console.log('[OpenAI] Transcribing audio...');
        return "Texto transcrito simulado do áudio.";
    }
}
