import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { ReminderService } from '@/lib/reminder-service';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');

    const records = phone
      ? await ReminderService.getHistoryByPhone(phone)
      : await ReminderService.getAll();

    return NextResponse.json(records.map(r => ({
      id: r.id,
      message: r.message,
      scheduledFor: r.remindAt.toISOString(),
      status: r.status,
      source: r.source,
      priority: r.priority,
      phone: r.phone,
      jid: r.jid,
      isGroup: r.isGroup,
      triggerRunId: r.triggerRunId,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
