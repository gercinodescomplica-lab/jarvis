import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { token } = await req.json();
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return response;
}
