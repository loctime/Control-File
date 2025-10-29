import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { createPresignedPostUrl } from '@/lib/b2';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Parse request body (aceptar ambos formatos y normalizar a name/size/mime)
    const raw = await request.json();
    const name = raw.name || raw.fileName;
    const size = (typeof raw.size === 'number' ? raw.size : undefined) ?? raw.fileSize;
    const mime = raw.mime || raw.mimeType;
    const parentId = raw.parentId ?? null;

    if (!name || !size || !mime) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos', message: 'name/fileName, size/fileSize y mime/mimeType son obligatorios' }, { status: 400 });
    }

    // Check user quota
    const adminDb = requireAdminDb();
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const usedBytes = userData.usedBytes || 0;
    const pendingBytes = userData.pendingBytes || 0;
    const planQuotaBytes = userData.planQuotaBytes;

    if (usedBytes + pendingBytes + size > planQuotaBytes) {
      return NextResponse.json({ 
        error: 'Cuota de almacenamiento excedida',
        usedBytes,
        pendingBytes,
        planQuotaBytes,
        requiredBytes: size
      }, { status: 413 });
    }

    // Generate unique file key
    const fileKey = `uploads/${userId}/${Date.now()}_${name}`;
    
    // Create presigned URL for upload
    const presignedData = await createPresignedPostUrl(fileKey, mime);

    // Create upload session in Firestore
    const uploadSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionRef = adminDb.collection('uploadSessions').doc(uploadSessionId);

    await sessionRef.set({
      userId,
      fileName: name,
      fileSize: size,
      mimeType: mime,
      parentId,
      bucketKey: fileKey,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Reservar bytes pendientes
    await userRef.update({
      pendingBytes: FieldValue.increment(size),
    });

    return NextResponse.json({
      success: true,
      uploadSessionId,
      presignedUrl: presignedData.url,
      fields: presignedData.fields,
      fileKey,
    });
  } catch (error) {
    logError(error, 'creating upload presigned URL');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
