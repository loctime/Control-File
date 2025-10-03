import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';
import { createPresignedGetUrl } from '@/lib/b2';

export async function POST(
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

    // Get file from Firestore
    const fileRef = adminDb.collection('files').doc(shareData.fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const fileData = fileDoc.data()!;

    if (fileData.isDeleted) {
      return NextResponse.json({ error: 'Archivo eliminado' }, { status: 404 });
    }

    // Generate presigned URL
    const downloadUrl = await createPresignedGetUrl(fileData.bucketKey, 300); // 5 minutes

    // Update download count
    await shareRef.update({
      downloadCount: shareData.downloadCount + 1,
    });

    return NextResponse.json({
      downloadUrl,
      fileName: fileData.name,
      fileSize: fileData.size,
    });
  } catch (error) {
    console.error('Error downloading shared file:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
