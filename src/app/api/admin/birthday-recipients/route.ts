import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { data, error } = await supabase
    .from('birthday_recipients')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const body = await req.json();
  const { whatsapp_id, label, active = true } = body;

  if (!whatsapp_id || !label) {
    return NextResponse.json({ error: 'whatsapp_id e label são obrigatórios' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('birthday_recipients')
    .insert({ whatsapp_id: whatsapp_id.trim(), label: label.trim(), active })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('create_birthday_recipient', whatsapp_id, { label });
  return NextResponse.json(data, { status: 201 });
}
