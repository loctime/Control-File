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
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json().catch(() => ({}));
    const fileIds: string[] = Array.isArray(body?.fileIds) ? body.fileIds : [];

    if (!fileIds.length) {
      return NextResponse.json({ error: 'Lista de archivos vacía' }, { status: 400 });
    }

    const adminDb = requireAdminDb();

    // Obtener documentos y validar pertenencia (sin getAll para compatibilidad)
    const fileRefs = fileIds.map((id) => adminDb.collection('files').doc(id));
    const fileDocs = await Promise.all(fileRefs.map((ref) => ref.get()));

    const validDocs: { id: string; size: number; bucketKey: string }[] = [];
    const notFound: string[] = [];
    const unauthorized: string[] = [];

    for (let i = 0; i < fileDocs.length; i++) {
      const doc = fileDocs[i];
      const id = fileIds[i];
      if (!doc.exists) {
        notFound.push(id);
        continue;
      }
      const data = doc.data() as any;
      if (data.userId !== userId) {
        unauthorized.push(id);
        continue;
      }
      validDocs.push({ id, size: data.size || 0, bucketKey: data.bucketKey });
    }

    // Eliminar en B2 (tolerante a errores)
    await Promise.all(
      validDocs.map(async ({ bucketKey }) => {
        try {
          if (bucketKey) {
            await deleteObject(bucketKey);
          }
        } catch (e) {
          // Continuar aunque falle B2 para algún archivo
          logger.warn('B2 delete falló para', { bucketKey, error: e instanceof Error ? e.message : String(e) });
        }
      })
    );

    // Borrar documentos en Firestore mediante batch
    const batch = adminDb.batch();
    validDocs.forEach(({ id }) => {
      batch.delete(adminDb.collection('files').doc(id));
    });
    await batch.commit();

    // Actualizar cuota del usuario (resta total de tamaños)
    const totalBytes = validDocs.reduce((acc, d) => acc + (typeof d.size === 'number' ? d.size : 0), 0);
    if (totalBytes) {
      await adminDb.collection('users').doc(userId).update({
        usedBytes: FieldValue.increment(-totalBytes),
      });
    }

    return NextResponse.json({
      success: true,
      deletedIds: validDocs.map((d) => d.id),
      notFound,
      unauthorized,
    });
  } catch (error) {
    logError(error, 'vaciar papelera');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}


