import { NextRequest, NextResponse } from 'next/server';
import { logger, logError } from '@/lib/logger-client';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { deleteObject } from '@/lib/b2';

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

    // Delete file from B2
    try {
      await deleteObject(fileData.bucketKey);
    } catch (error) {
      logError(error, 'deleting from B2');
      // Continue with Firestore deletion even if B2 fails
    }

    // Delete file document from Firestore
    await fileRef.delete();

    // Update user quota
    const userRef = adminDb.collection('users').doc(userId);
    await userRef.update({
      usedBytes: FieldValue.increment(-fileData.size),
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Archivo eliminado exitosamente' 
    });
  } catch (error) {
    logError(error, 'deleting file');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
