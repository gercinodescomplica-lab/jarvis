import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const { data, error } = await supabase.from('whitelist').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const body = await req.json();
  const phone = String(body.phone).replace(/\D/g, '');
  if (!phone || !body.name) return NextResponse.json({ error: 'phone e name são obrigatórios' }, { status: 400 });
  const { data, error } = await supabase.from('whitelist').insert({
    phone,
    name: body.name,
    can_store_memory: body.can_store_memory ?? false,
    active: body.active ?? true,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
