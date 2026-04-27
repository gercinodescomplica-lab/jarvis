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
  if (body.label !== undefined) update.label = body.label;
  if (body.whatsapp_id !== undefined) update.whatsapp_id = body.whatsapp_id;
  if (body.active !== undefined) update.active = body.active;

  const { data, error } = await supabase
    .from('birthday_recipients')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('update_birthday_recipient', id, update);
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { id } = await params;
  const { error } = await supabase.from('birthday_recipients').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('delete_birthday_recipient', id, {});
  return NextResponse.json({ success: true });
}
