import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { getAgendaSemana } from '@/cron/agenda';

export async function GET(req: Request) {
  const err = validateAdminRequest(req);
  if (err) return err;
  try {
    const report = await getAgendaSemana();
    return NextResponse.json({ report });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
