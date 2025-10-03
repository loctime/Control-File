import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
    }

    // Get share from Firestore
    const adminDb = requireAdminDb();
    const shareRef = adminDb.collection('shares').doc(token);
    const shareDoc = await shareRef.get();

    if (!shareDoc.exists) {
      return NextResponse.json({ error: 'Enlace de compartir no encontrado' }, { status: 404 });
    }

    const shareData = shareDoc.data()!;

    // Check if share is expired
    if (shareData.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: 'Enlace expirado' }, { status: 410 });
    }

    // Check if share is active
    if (!shareData.isActive) {
      return NextResponse.json({ error: 'Enlace revocado' }, { status: 410 });
    }

    return NextResponse.json({
      fileName: shareData.fileName,
      fileSize: shareData.fileSize,
      mime: shareData.mime,
      expiresAt: shareData.expiresAt.toDate().toISOString(),
      downloadCount: shareData.downloadCount,
    });
  } catch (error) {
    console.error('Error getting share info:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
