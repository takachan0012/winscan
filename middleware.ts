import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Clean URL parameters - remove leading/trailing spaces from path segments
  const pathname = request.nextUrl.pathname;
  const cleanedPathname = pathname
    .split('/')
    .map(segment => decodeURIComponent(segment).trim())
    .map(segment => encodeURIComponent(segment))
    .join('/');
  
  // Redirect if pathname has changed after cleaning
  if (cleanedPathname !== pathname && !pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    url.pathname = cleanedPathname;
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next();

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { 
        status: 204,
        headers: response.headers 
      });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)', '/api/:path*'],
};
