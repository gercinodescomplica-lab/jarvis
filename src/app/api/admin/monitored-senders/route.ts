import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const mailbox = searchParams.get('mailbox');

  let query = supabase.from('monitored_senders').select('*').order('created_at', { ascending: false });
  if (mailbox) query = query.eq('mailbox', mailbox);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const body = await req.json();
  const { mailbox, sender_email, sender_name, priority } = body;

  if (!mailbox || !sender_email || !sender_name) {
    return NextResponse.json({ error: 'mailbox, sender_email e sender_name são obrigatórios' }, { status: 400 });
  }

  const validPriorities = ['high', 'medium', 'low'];
  const finalPriority = validPriorities.includes(priority) ? priority : 'medium';

  const { data, error } = await supabase
    .from('monitored_senders')
    .insert({ mailbox, sender_email, sender_name, priority: finalPriority, active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction('create_monitored_sender', sender_email, { mailbox, priority: finalPriority });
  return NextResponse.json(data, { status: 201 });
}
