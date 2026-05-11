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

  const { data, error } = await supabase
    .from('grc_users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { id } = await params;
  const { error } = await supabase.from('grc_users').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
