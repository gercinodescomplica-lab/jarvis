import { createLogger } from './logger';
import { TelegramConfigService } from './telegram-config';

const logger = createLogger('telegram-sender');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramMessage(text: string, chatId?: string) {
    const targetChatId = chatId || TelegramConfigService.getChatId();

    if (!TELEGRAM_BOT_TOKEN) {
        logger.warn(" TELEGRAM_BOT_TOKEN not set. Skipping message.");
        return;
    }

    if (!targetChatId) {
        logger.warn(" TELEGRAM_CHAT_ID not set (and no chatId provided). Skipping message.");
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
            logger.error(` Failed to send message: ${err}`);
        } else {
            logger.info(` Message sent to ${targetChatId}`);
        }
    } catch (error) {
        logger.error('Network error', error);
    }
}
