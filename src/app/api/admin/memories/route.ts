import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const phone = new URL(req.url).searchParams.get('phone');
  let query = supabase.from('memories').select('id, phone, content, source, created_at').order('created_at', { ascending: false }).limit(100);
  if (phone) query = query.eq('phone', phone);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
