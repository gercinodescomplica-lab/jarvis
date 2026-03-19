const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
import { TelegramConfigService } from './telegram-config';

export async function sendTelegramMessage(text: string, chatId?: string) {
    const targetChatId = chatId || TelegramConfigService.getChatId();

    if (!TELEGRAM_BOT_TOKEN) {
        console.warn("[TelegramSender] TELEGRAM_BOT_TOKEN not set. Skipping message.");
        return;
    }

    if (!targetChatId) {
        console.warn("[TelegramSender] TELEGRAM_CHAT_ID not set (and no chatId provided). Skipping message.");
        return;
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: targetChatId,
                text: text,
                parse_mode: 'Markdown'
            })
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`[TelegramSender] Failed to send message: ${err}`);
        } else {
            console.log(`[TelegramSender] Message sent to ${targetChatId}`);
        }
    } catch (error) {
        console.error("[TelegramSender] Network error:", error);
    }
}
