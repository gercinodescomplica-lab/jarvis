import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const { data, error } = await supabase
    .from('admin_logs')
    .select('id, action, target, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
