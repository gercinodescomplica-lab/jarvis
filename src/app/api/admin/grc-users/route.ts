import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { data, error } = await supabase
    .from('grc_users')
    .select('*')
    .order('display_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const body = await req.json();
  const phone = String(body.phone ?? '').replace(/\D/g, '');

  if (!phone) return NextResponse.json({ error: 'phone é obrigatório' }, { status: 400 });
  if (!body.manager_id?.trim()) return NextResponse.json({ error: 'manager_id é obrigatório' }, { status: 400 });
  if (!body.display_name?.trim()) return NextResponse.json({ error: 'display_name é obrigatório' }, { status: 400 });

  const active = body.active ?? true;
  const displayName = body.display_name.trim();

  const { data, error } = await supabase
    .from('grc_users')
    .insert({ phone, manager_id: body.manager_id.trim(), display_name: displayName, active })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Garante que o gerente já entra autorizado na whitelist com permissão de memória
  await supabase.from('whitelist').upsert(
    { phone, name: displayName, active, can_store_memory: true },
    { onConflict: 'phone' }
  );

  return NextResponse.json(data, { status: 201 });
}
