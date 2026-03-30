import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  const url = new URL(req.url);
  const phone = url.searchParams.get('phone');

  // Mensagens por usuário
  let chatQuery = supabase
    .from('chats')
    .select('phone, role, created_at')
    .in('role', ['user', 'assistant']);
  if (phone) chatQuery = chatQuery.eq('phone', phone);

  const [{ data: chats }, { data: memories }, { data: docs }] = await Promise.all([
    chatQuery,
    supabase.from('memories').select('phone, created_at'),
    supabase.from('documents').select('uploader_phone, created_at'),
  ]);

  // Agrupa por phone
  const byPhone: Record<string, {
    phone: string;
    total_msgs: number;
    user_msgs: number;
    last_active: number;
    memories_count: number;
    docs_count: number;
  }> = {};

  for (const row of chats ?? []) {
    if (!byPhone[row.phone]) {
      byPhone[row.phone] = { phone: row.phone, total_msgs: 0, user_msgs: 0, last_active: 0, memories_count: 0, docs_count: 0 };
    }
    byPhone[row.phone].total_msgs++;
    if (row.role === 'user') byPhone[row.phone].user_msgs++;
    if (row.created_at > byPhone[row.phone].last_active) byPhone[row.phone].last_active = row.created_at;
  }

  for (const row of memories ?? []) {
    if (!byPhone[row.phone]) continue;
    byPhone[row.phone].memories_count++;
  }

  for (const row of docs ?? []) {
    const p = row.uploader_phone;
    if (!byPhone[p]) continue;
    byPhone[p].docs_count++;
  }

  const analytics = Object.values(byPhone).sort((a, b) => b.last_active - a.last_active);

  return NextResponse.json({ analytics });
}
