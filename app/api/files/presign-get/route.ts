import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { createPresignedGetUrl } from '@/lib/b2';

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
    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'ID de archivo requerido' }, { status: 400 });
    }

    // Get file document
    const adminDb = requireAdminDb();
    const fileRef = adminDb.collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const fileData = fileDoc.data()!;
    
    // Verify file belongs to user
    if (fileData.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Generate presigned URL
    const presignedUrl = await createPresignedGetUrl(fileData.bucketKey, 300);

    // Mantener compatibilidad con el hook existente que espera downloadUrl
    return NextResponse.json({ 
      success: true, 
      downloadUrl: presignedUrl,
      fileName: fileData.name,
      mimeType: fileData.mime
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
