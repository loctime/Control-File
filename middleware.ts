import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Proteger rutas de platform console
  if (request.nextUrl.pathname.startsWith('/platform/console')) {
    // La verificación real se hace en el componente con el token
    // Este middleware solo redirige si no hay token en headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      // Redirigir a auth si no hay token (el componente verificará el claim)
      return NextResponse.redirect(new URL('/auth', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/platform/:path*',
};
