import { NextResponse } from 'next/server';
import { GraphCalendarAdapter } from '@jarvis/adapters/src/ms-graph';

export const maxDuration = 30;

async function getCalendarContext(messages: any[]) {
    // Basic intent detection for calendar
    const lastMessage = messages[messages.length - 1].content.toLowerCase();
    const hasKeywords = ["agenda", "calendário", "reunião", "compromissos", "meeting", "evento"].some(k => lastMessage.includes(k));
    const mentionsName = ["tiago", "danielle", "dani", "gercino", "neto"].some(k => lastMessage.includes(k));

    if (hasKeywords || mentionsName) {
        console.log("[Chat API] Detecting calendar intent, fetching data...");
        try {
            const adapter = new GraphCalendarAdapter();
            const configEmails = (process.env.GRAPH_USER_EMAILS || "").split(',').filter(Boolean);
            let targetEmails = configEmails;

            if (lastMessage.includes('tiago')) targetEmails = ['tiagoluz@prodam.sp.gov.br'];
            else if (lastMessage.includes('danielle') || lastMessage.includes('dani')) targetEmails = ['danielleoliveira@prodam.sp.gov.br'];
            else if (lastMessage.includes('gercino') || lastMessage.includes('neto')) targetEmails = ['gercinoneto@prodam.sp.gov.br'];

            const results = await adapter.getEventsForUsers(targetEmails);
            const eventsText = results.map(r => {
                if (r.error) return `- ${r.user}: Erro ao buscar dados.`;
                if (!r.events || r.events.length === 0) return `- ${r.user}: Sem compromissos encontrados para os próximos 7 dias.`;
                return `- ${r.user}:\n  ` + r.events.map((e: any) => {
                    const eventDate = new Date(e.start.dateTime).toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        weekday: 'long',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    return `* ${e.subject} (${eventDate}) - Local: ${e.location?.displayName || 'N/A'}`;
                }).join('\n  ');
            }).join('\n');

            return `\n\nINFORMAÇÕES DE CALENDÁRIO (USE ISSO PARA RESPONDER):\n${eventsText}\n\n`;
        } catch (e) {
            console.error("Calendar fetch failed:", e);
        }
    }
    return "";
}

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 1. Fetch Calendar Context if needed
        const calendarContext = await getCalendarContext(messages);

        // 2. Prepare Payload (Back to original construction that worked)
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "https://oia-gercinotest.openai.azure.com/";
        const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4.1-mini";
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview";

        // EXATAMENTE como estava antes (com o possível double slash do endpoint)
        const azureUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

        console.log(`[Manual Chat] Fetching: ${azureUrl}`);

        const response = await fetch(azureUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": apiKey || ""
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: `You are Jarvis, a highly advanced AI Assistant. Be warm, concise and helpful. 
                        IMPORTANT: Use periods and commas frequently to split long sentences, as our voice system has limits on sentence length.
                        CURRENT BRAZIL DATE/TIME: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}${calendarContext}`
                    },
                    ...messages
                ],
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            console.error("[Azure API Error]", error);
            return NextResponse.json(error, { status: response.status });
        }

        // 3. Manual Stream Implementation (Vercel AI SDK v1 wire format)
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const decoder = new TextDecoder();
                const reader = response.body!.getReader();
                const messageId = `msg-${Date.now()}`;

                controller.enqueue(encoder.encode(`0:${JSON.stringify({ id: messageId, role: 'assistant' })}\n`));

                let buffer = "";
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            const cleanLine = line.trim();
                            if (!cleanLine || cleanLine === "data: [DONE]") continue;

                            if (cleanLine.startsWith("data: ")) {
                                try {
                                    const data = JSON.parse(cleanLine.slice(6));
                                    const content = data.choices[0]?.delta?.content;
                                    if (content) {
                                        controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                                    }
                                } catch (e) { }
                            }
                        }
                    }
                    controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
                } catch (error) {
                    console.error('[Stream Error]:', error);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'x-vercel-ai-data-stream': 'v1',
            }
        });

    } catch (err) {
        console.error("[API Chat] Internal Error:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
