import { supabase } from '@/db';

export interface Reminder {
    id: string;
    message: string;
    remindAt: Date;
    chatId: string;
    sent: boolean;
    createdAt: Date;
    // enriched fields
    phone: string | null;
    jid: string | null;
    isGroup: boolean;
    triggerRunId: string | null;
    status: 'pending' | 'sent' | 'cancelled' | 'failed';
    source: 'whatsapp' | 'telegram' | 'chat';
    priority: 'low' | 'normal' | 'high';
    recurrence: string | null;
}

export class ReminderService {
    static async create(message: string, remindAt: Date, chatId: string): Promise<Reminder> {
        const { data, error } = await supabase
            .from('reminders')
            .insert({ message, remind_at: remindAt.toISOString(), chat_id: chatId, source: 'telegram' })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return this.map(data);
    }

    static async createWhatsApp(
        message: string,
        remindAt: Date,
        phone: string,
        jid: string,
        isGroup: boolean,
        triggerRunId: string,
        priority: 'low' | 'normal' | 'high' = 'normal',
    ): Promise<Reminder> {
        const { data, error } = await supabase
            .from('reminders')
            .insert({
                message,
                remind_at: remindAt.toISOString(),
                chat_id: jid,
                phone,
                jid,
                is_group: isGroup,
                trigger_run_id: triggerRunId,
                status: 'pending',
                source: 'whatsapp',
                priority,
            })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return this.map(data);
    }

    static async getDue(): Promise<Reminder[]> {
        const { data, error } = await supabase
            .from('reminders')
            .select('*')
            .lte('remind_at', new Date().toISOString())
            .eq('sent', false)
            .eq('status', 'pending')
            .order('remind_at', { ascending: true });
        if (error) throw new Error(error.message);
        return (data ?? []).map(this.map);
    }

    static async markSent(id: string): Promise<void> {
        await supabase
            .from('reminders')
            .update({ sent: true, status: 'sent' })
            .eq('id', id);
    }

    static async markSentByRunId(triggerRunId: string): Promise<void> {
        await supabase
            .from('reminders')
            .update({ sent: true, status: 'sent' })
            .eq('trigger_run_id', triggerRunId);
    }

    static async markCancelledByRunId(triggerRunId: string): Promise<void> {
        await supabase
            .from('reminders')
            .update({ status: 'cancelled' })
            .eq('trigger_run_id', triggerRunId)
            .eq('status', 'pending');
    }

    static async getPendingByPhone(phone: string): Promise<Reminder[]> {
        const { data, error } = await supabase
            .from('reminders')
            .select('*')
            .eq('phone', phone)
            .eq('status', 'pending')
            .order('remind_at', { ascending: true });
        if (error) throw new Error(error.message);
        return (data ?? []).map(this.map);
    }

    static async getHistoryByPhone(phone: string, limit = 20): Promise<Reminder[]> {
        const { data, error } = await supabase
            .from('reminders')
            .select('*')
            .eq('phone', phone)
            .order('remind_at', { ascending: false })
            .limit(limit);
        if (error) throw new Error(error.message);
        return (data ?? []).map(this.map);
    }

    static async getAll(): Promise<Reminder[]> {
        const { data, error } = await supabase
            .from('reminders')
            .select('*')
            .order('remind_at', { ascending: false });
        if (error) throw new Error(error.message);
        return (data ?? []).map(this.map);
    }

    static async deleteById(id: string): Promise<void> {
        await supabase.from('reminders').delete().eq('id', id);
    }

    private static map(row: any): Reminder {
        return {
            id: row.id,
            message: row.message,
            remindAt: new Date(row.remind_at),
            chatId: row.chat_id,
            sent: row.sent ?? false,
            createdAt: new Date(row.created_at),
            phone: row.phone ?? null,
            jid: row.jid ?? null,
            isGroup: row.is_group ?? false,
            triggerRunId: row.trigger_run_id ?? null,
            status: row.status ?? 'pending',
            source: row.source ?? 'whatsapp',
            priority: row.priority ?? 'normal',
            recurrence: row.recurrence ?? null,
        };
    }
}
