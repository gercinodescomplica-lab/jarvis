import { NextRequest, NextResponse } from 'next/server';
import { JarvisIntelligence } from '@/lib/jarvis-intelligence';
import { TelegramConfigService } from '@/lib/telegram-config';
import { createLogger } from '@/lib/logger';
import { retryAsync } from '@/lib/retry';

const logger = createLogger('telegram');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId: string, text: string) {
    if (!TELEGRAM_BOT_TOKEN) return;

    await retryAsync(
        async () => {
            const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
            });
            if (!res.ok) throw new Error(`Telegram API error: ${await res.text()}`);
        },
        {
            attempts: 3,
            delayMs: 400,
            onRetry: (attempt, err) => logger.warn(`sendTelegramMessage tentativa ${attempt} falhou`, err),
        }
    ).catch(err => logger.error('Falha ao enviar mensagem Telegram após 3 tentativas', err));
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.message || !body.message.text) {
            return NextResponse.json({ ok: true });
        }

        const chatId = body.message.chat.id.toString();
        const userText = body.message.text;

        TelegramConfigService.saveChatId(chatId);

        logger.info(`Recebido: "${userText}" de ${chatId}`);

        const intelligenceResult = await JarvisIntelligence.processQuery(userText, chatId);

        let replyText = '';

        if (intelligenceResult.type === 'SET_REMINDER') {
            replyText = intelligenceResult.summary;
        } else if (intelligenceResult.type === 'CALENDAR') {
            replyText = `📅 **Agenda Encontrada**\n\n`;
            if (intelligenceResult.data.length === 0) {
                replyText += 'Nenhuma reunião nas próximas 24h.';
            } else {
                intelligenceResult.data.forEach((evt: any) => {
                    replyText += `⏰ *${evt.start.split('T')[1].substring(0, 5)}* - ${evt.subject}\n`;
                    replyText += `📍 ${evt.location}\n\n`;
                });
            }
        } else if (intelligenceResult.type === 'CHIT_CHAT') {
            replyText = 'Olá! Como posso ajudar? Posso buscar projetos, agenda, criar tarefas ou definir lembretes.';
        } else if (intelligenceResult.data.length > 0) {
            replyText = `📂 **Projetos Encontrados**\n\n`;
            replyText += intelligenceResult.summary + '\n\n';

            intelligenceResult.data.slice(0, 5).forEach((p: any) => {
                replyText += `*${p.title}*\n`;
                replyText += `Status: ${p.status}\n`;
                if (p.deadline) replyText += `Prazo: ${p.deadline}\n`;
                replyText += `[Link Notion](${p.url})\n\n`;
            });
        } else {
            replyText = 'Não encontrei informações sobre isso no Notion ou Agenda.';
        }

        await sendTelegramMessage(chatId, replyText);

        return NextResponse.json({ ok: true });

    } catch (error) {
        logger.error('Erro ao processar mensagem', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
