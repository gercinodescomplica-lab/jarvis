import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { data, error } = await supabase
    .from('email_mailbox_configs')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const body = await req.json();
  const { mailbox, label, whatsapp_phone } = body;

  if (!mailbox || !label || !whatsapp_phone) {
    return NextResponse.json({ error: 'mailbox, label e whatsapp_phone são obrigatórios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('email_mailbox_configs')
    .insert({ mailbox, label, whatsapp_phone, active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('create_email_mailbox_config', mailbox, { label, whatsapp_phone });
  return NextResponse.json(data, { status: 201 });
}
