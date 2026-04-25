import { NextResponse } from 'next/server';

export function validateAdminRequest(req: Request): NextResponse | null {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return NextResponse.json({ error: 'ADMIN_TOKEN not configured' }, { status: 500 });

  const authHeader = req.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const urlToken = new URL(req.url).searchParams.get('token');

  if (headerToken !== token && urlToken !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
