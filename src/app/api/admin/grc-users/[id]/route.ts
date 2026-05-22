import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.phone !== undefined) updates.phone = String(body.phone).replace(/\D/g, '');
  if (body.manager_id !== undefined) updates.manager_id = body.manager_id;
  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.active !== undefined) updates.active = body.active;

  // Busca o telefone atual antes de atualizar (necessário para sincronizar a whitelist)
  const { data: current } = await supabase
    .from('grc_users').select('phone').eq('id', id).single();

  const { data, error } = await supabase
    .from('grc_users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mantém whitelist em sync: active, name e phone
  if (current?.phone) {
    const whitelistPatch: Record<string, unknown> = {};
    if (body.active !== undefined) whitelistPatch.active = body.active;
    if (body.display_name !== undefined) whitelistPatch.name = body.display_name;
    if (body.phone !== undefined) whitelistPatch.phone = String(body.phone).replace(/\D/g, '');

    if (Object.keys(whitelistPatch).length > 0) {
      await supabase.from('whitelist').update(whitelistPatch).eq('phone', current.phone);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { id } = await params;

  // Busca o telefone antes de deletar para desativar na whitelist
  const { data: current } = await supabase
    .from('grc_users').select('phone').eq('id', id).single();

  const { error } = await supabase.from('grc_users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Desativa na whitelist (não deleta para manter histórico)
  if (current?.phone) {
    await supabase.from('whitelist').update({ active: false }).eq('phone', current.phone);
  }

  return NextResponse.json({ success: true });
}
