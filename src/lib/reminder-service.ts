import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || '');

export interface Reminder {
    id: string;
    message: string;
    remindAt: Date;
    chatId: string;
    sent: boolean;
    createdAt: Date;
}

export class ReminderService {
    static async create(message: string, remindAt: Date, chatId: string): Promise<Reminder> {
        const [row] = await sql`
            insert into reminders (message, remind_at, chat_id)
            values (${message}, ${remindAt.toISOString()}, ${chatId})
            returning *
        `;
        return this.map(row);
    }

    static async getDue(): Promise<Reminder[]> {
        const rows = await sql`
            select * from reminders
            where remind_at <= now() and sent = false
            order by remind_at asc
        `;
        return rows.map((r: any) => this.map(r));
    }

    static async markSent(id: string): Promise<void> {
        await sql`update reminders set sent = true where id = ${id}`;
    }

    private static map(row: any): Reminder {
        return {
            id: row.id,
            message: row.message,
            remindAt: new Date(row.remind_at),
            chatId: row.chat_id,
            sent: row.sent,
            createdAt: new Date(row.created_at),
        };
    }
}
