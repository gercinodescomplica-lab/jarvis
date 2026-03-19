import { NextRequest, NextResponse } from 'next/server';
import { JarvisIntelligence } from '@/lib/jarvis-intelligence';
import { TelegramConfigService } from '@/lib/telegram-config';

const TELEGRAM_bot_token = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId: string, text: string) {
    if (!TELEGRAM_bot_token) return;

    // Telegram implies Markdown, but Jarvis formats for Markdown. 
    // We need to be careful with MarkdownV2 escaping in Telegram. 
    // For safety/simplicity, we might use "Markdown" (V1) or just plain text first.
    // Let's iterate.

    await fetch(`https://api.telegram.org/bot${TELEGRAM_bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text, // Jarvis returns Markdown usually
            parse_mode: 'Markdown'
        })
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Check if it's a message
        if (!body.message || !body.message.text) {
            return NextResponse.json({ ok: true }); // Ignore non-text updates
        }

        const chatId = body.message.chat.id.toString();
        const userText = body.message.text;

        // Auto-Discovery: Save the Chat ID
        TelegramConfigService.saveChatId(chatId);

        console.log(`[Telegram] Received: "${userText}" from ${chatId}`);

        // 1. Process with Jarvis Intelligence
        // We reuse the same logic as the main Chat API
        const intelligenceResult = await JarvisIntelligence.processQuery(userText);

        // 2. Format Response (Reuse logic or simplify)
        let replyText = "";

        if (intelligenceResult.type === "CALENDAR") {
            replyText = `📅 **Agenda Encontrada**\n\n`;
            if (intelligenceResult.data.length === 0) {
                replyText += "Nenhuma reunião nas próximas 24h.";
            } else {
                intelligenceResult.data.forEach((evt: any, idx: number) => {
                    replyText += `⏰ *${evt.start.split('T')[1].substring(0, 5)}* - ${evt.subject}\n`;
                    replyText += `📍 ${evt.location}\n\n`;
                });
            }
        } else if (intelligenceResult.data.length > 0) {
            // Projects
            replyText = `📂 **Projetos Encontrados**\n\n`;
            replyText += intelligenceResult.summary + "\n\n";

            intelligenceResult.data.slice(0, 5).forEach((p: any) => {
                replyText += `*${p.title}*\n`;
                replyText += `Status: ${p.status}\n`;
                if (p.deadline) replyText += `Prazo: ${p.deadline}\n`;
                replyText += `[Link Notion](${p.url})\n\n`;
            });
        } else {
            // Fallback / Not Found
            // Ideally we'd ask the LLM to chit-chat here, but for this strict Endpoint:
            replyText = "Não encontrei informações sobre isso no Notion ou Agenda.";
        }

        // Add a footer confirming connection if it's new (logic simplified: just append if it was a greeting?)
        // Or better: The user just sent a msg, so we are connected.
        // Let's just reply naturally.

        // 3. Send Reply
        await sendTelegramMessage(chatId, replyText);

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error("[Telegram] Error:", error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
