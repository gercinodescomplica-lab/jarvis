import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DB_DIR, 'telegram-config.json');

interface TelegramConfig {
    chatId?: string;
    updatedAt?: string;
}

export class TelegramConfigService {
    private static ensureDb() {
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }
        if (!fs.existsSync(CONFIG_FILE)) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2));
        }
    }

    static getChatId(): string | undefined {
        // Priority: ENV > File
        if (process.env.TELEGRAM_CHAT_ID) {
            return process.env.TELEGRAM_CHAT_ID;
        }

        try {
            this.ensureDb();
            const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
            const config: TelegramConfig = JSON.parse(content);
            return config.chatId;
        } catch (error) {
            console.error("[TelegramConfig] Error reading config:", error);
            return undefined;
        }
    }

    static saveChatId(chatId: string) {
        try {
            this.ensureDb();
            const config: TelegramConfig = { chatId, updatedAt: new Date().toISOString() };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
            console.log(`[TelegramConfig] Saved Chat ID: ${chatId}`);
        } catch (error) {
            console.error("[TelegramConfig] Error saving config:", error);
        }
    }
}
