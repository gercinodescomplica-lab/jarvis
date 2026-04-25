import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { supabase } from '@/db';
import { configure, runs } from '@trigger.dev/sdk/v3';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;

  configure({ secretKey: process.env.TRIGGER_SECRET_KEY! });

  const [
    { count: whitelistTotal },
    { count: whitelistActive },
    { count: memories },
    { count: documents },
    triggerPage,
  ] = await Promise.all([
    supabase.from('whitelist').select('*', { count: 'exact', head: true }),
    supabase.from('whitelist').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('memories').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    runs.list({ taskIdentifier: 'send-reminder', limit: 50 }).catch(() => ({ data: [] })),
  ]);

  const pending = ['DELAYED', 'WAITING', 'QUEUED', 'EXECUTING'];
  const pendingReminders = (triggerPage.data as any[]).filter(r => pending.includes(r.status)).length;

  return NextResponse.json({
    whitelist: { total: whitelistTotal ?? 0, active: whitelistActive ?? 0, inactive: (whitelistTotal ?? 0) - (whitelistActive ?? 0) },
    memories: memories ?? 0,
    documents: documents ?? 0,
    pendingReminders,
  });
}
