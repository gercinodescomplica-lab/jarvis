import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow API routes, static files, and Next.js internal files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('/static') ||
    pathname.includes('.') // common files like favicon.ico, images, etc.
  ) {
    return NextResponse.next();
  }

  const token = searchParams.get('token');
  const storedToken = process.env.FRONTEND_ACCESS_TOKEN;
  const cookieToken = request.cookies.get('frontend_token')?.value;

  // If token is in URL and correct
  if (token && token === storedToken) {
    const response = NextResponse.next();
    // Set cookie so they don't have to keep the token in URL
    response.cookies.set('frontend_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    return response;
  }

  // If already has valid cookie
  if (cookieToken && cookieToken === storedToken) {
    return NextResponse.next();
  }

  // Otherwise, block access
  return new NextResponse(
    `<html>
      <body style="background: #0f172a; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
        <div style="text-align: center; border: 1px solid #1e293b; padding: 2rem; border-radius: 1rem; background: #1e293b; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #6366f1;">Rex Intelligence</h1>
          <p style="color: #94a3b8;">Frontend access is restricted.</p>
          <div style="margin-top: 1.5rem; font-size: 0.875rem; color: #64748b;">
            Please provide a valid token to proceed.
          </div>
        </div>
      </body>
    </html>`,
    {
      status: 401,
      headers: { 'content-type': 'text/html' },
    }
  );
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
