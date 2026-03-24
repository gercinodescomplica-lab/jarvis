import { NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/admin-auth';
import { configure, runs } from '@trigger.dev/sdk/v3';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = validateAdminRequest(req);
  if (err) return err;
  const { id } = await params;

  configure({ secretKey: process.env.TRIGGER_SECRET_KEY! });

  try {
    await runs.cancel(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
