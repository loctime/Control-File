import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const { shareId } = await request.json();

    if (!shareId) {
      return NextResponse.json({ error: 'ID de compartir requerido' }, { status: 400 });
    }

    // Get share document
    const adminDb = requireAdminDb();
    const shareRef = adminDb.collection('shares').doc(shareId);
    const shareDoc = await shareRef.get();

    if (!shareDoc.exists) {
      return NextResponse.json({ error: 'Compartir no encontrado' }, { status: 404 });
    }

    const shareData = shareDoc.data()!;
    
    // Verify share belongs to user
    if (shareData.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Delete share document
    await shareRef.delete();

    return NextResponse.json({ 
      success: true, 
      message: 'Compartir revocado exitosamente' 
    });
  } catch (error) {
    logError(error, 'revoking share');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
