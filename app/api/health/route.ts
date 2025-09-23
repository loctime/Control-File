// app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Verificar que el servidor está funcionando
    return NextResponse.json(
      { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  // Para verificaciones rápidas de conectividad
  return new NextResponse(null, { status: 200 });
}
