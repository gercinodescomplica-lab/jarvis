import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { logAdminAction } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ mailbox: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { mailbox } = await params;
  const body = await req.json();
  const newMailbox: string | undefined = body.new_mailbox?.trim().toLowerCase();

  // ── Rename: mailbox é PK, precisa recriar o registro e atualizar as FKs ──
  if (newMailbox && newMailbox !== mailbox) {
    const { data: current, error: fetchErr } = await supabase
      .from('email_mailbox_configs').select('*').eq('mailbox', mailbox).single();
    if (fetchErr || !current) return NextResponse.json({ error: 'Caixa não encontrada' }, { status: 404 });

    const merged = {
      mailbox: newMailbox,
      label: body.label ?? current.label,
      whatsapp_phone: body.whatsapp_phone ?? current.whatsapp_phone,
      active: body.active ?? current.active,
    };

    // 1. Atualiza FKs nas tabelas dependentes
    await supabase.from('monitored_senders').update({ mailbox: newMailbox }).eq('mailbox', mailbox);
    await supabase.from('email_delta_tokens').update({ mailbox: newMailbox }).eq('mailbox', mailbox);

    // 2. Insere novo registro e remove o antigo
    const { error: insertErr } = await supabase.from('email_mailbox_configs').insert(merged);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    await supabase.from('email_mailbox_configs').delete().eq('mailbox', mailbox);

    await logAdminAction('rename_email_mailbox_config', mailbox, { new_mailbox: newMailbox });
    return NextResponse.json(merged);
  }

  // ── Update simples (sem alterar o email) ──────────────────────────────────
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
