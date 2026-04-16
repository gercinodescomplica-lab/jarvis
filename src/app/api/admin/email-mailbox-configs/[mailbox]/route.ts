import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { logAdminAction } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ mailbox: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { mailbox } = await params;
  const body = await req.json();
  const update: any = {};

  if (body.label !== undefined) update.label = body.label;
  if (body.whatsapp_phone !== undefined) update.whatsapp_phone = body.whatsapp_phone;
  if (body.active !== undefined) update.active = body.active;

  const { data, error } = await supabase
    .from('email_mailbox_configs')
    .update(update)
    .eq('mailbox', mailbox)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('update_email_mailbox_config', mailbox, update);
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ mailbox: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { mailbox } = await params;

  // Limpa também o delta token associado
  await supabase.from('email_delta_tokens').delete().eq('mailbox', mailbox);

  const { error } = await supabase.from('email_mailbox_configs').delete().eq('mailbox', mailbox);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('delete_email_mailbox_config', mailbox, {});
  return NextResponse.json({ success: true });
}
