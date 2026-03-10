import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function backendUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const upstream = await fetch(`${backendUrl()}/v1/shares/${params.token}/image`, {
      method: 'GET',
      redirect: 'manual',
    });

    if ([301, 302, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get('location');
      if (location) {
        return NextResponse.redirect(location);
      }
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': contentType || 'application/octet-stream' },
    });
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
