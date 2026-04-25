import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { logAdminAction } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { id } = await params;
  const body = await req.json();
  const update: any = {};

  if (body.sender_name !== undefined) update.sender_name = body.sender_name;
  if (body.priority !== undefined && ['high', 'medium', 'low'].includes(body.priority)) {
    update.priority = body.priority;
  }
  if (body.active !== undefined) update.active = body.active;

  const { data, error } = await supabase
    .from('monitored_senders')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('update_monitored_sender', id, update);
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { id } = await params;
  const { error } = await supabase.from('monitored_senders').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('delete_monitored_sender', id, {});
  return NextResponse.json({ success: true });
}
