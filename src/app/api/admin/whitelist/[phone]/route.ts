import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ phone: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const { phone } = await params;
  const body = await req.json();
  const update: any = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.can_store_memory !== undefined) update.can_store_memory = body.can_store_memory;
  if (body.active !== undefined) update.active = body.active;
  const { data, error } = await supabase.from('whitelist').update(update).eq('phone', phone).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ phone: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const { phone } = await params;
  const { error } = await supabase.from('whitelist').delete().eq('phone', phone);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
