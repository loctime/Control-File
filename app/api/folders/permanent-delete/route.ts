import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { deleteObject } from '@/lib/b2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function deleteFolderRecursive(adminDb: FirebaseFirestore.Firestore, userId: string, folderId: string) {
  console.log('[folders/permanent-delete] Recursivo en', { folderId });
  // 1) Borrar archivos dentro de la carpeta
  const filesSnap = await adminDb
    .collection('files')
    .where('userId', '==', userId)
    .where('parentId', '==', folderId)
    .get();

  const fileDeletes: Promise<any>[] = [];
  filesSnap.forEach((doc) => {
    const data = doc.data() as any;
    const bucketKey: string | undefined = data?.bucketKey;
    // borrar en B2 si existe
    if (bucketKey) {
      fileDeletes.push(
        deleteObject(bucketKey).catch(() => {})
      );
    }
    fileDeletes.push(doc.ref.delete());
  });
  await Promise.all(fileDeletes);

  // 2) Obtener subcarpetas y borrarlas recursivamente
  const subfoldersSnap = await adminDb
    .collection('files')
    .where('userId', '==', userId)
    .where('type', '==', 'folder')
    .where('parentId', '==', folderId)
    .get();

  for (const subDoc of subfoldersSnap.docs) {
    await deleteFolderRecursive(adminDb, userId, subDoc.id);
  }

  // 3) Finalmente borrar la carpeta actual
  await adminDb.collection('files').doc(folderId).delete();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;

    const body = await request.json().catch(() => ({}));
    const { folderId } = body || {};
    if (!folderId || typeof folderId !== 'string') {
      return NextResponse.json({ error: 'ID de carpeta requerido' }, { status: 400 });
    }

    const adminDb = requireAdminDb();
    console.log('[folders/permanent-delete] Solicitud recibida', { userId, folderId });
    const folderRef = adminDb.collection('files').doc(folderId);
    const folderDoc = await folderRef.get();
    if (!folderDoc.exists) {
      // Si no existe, considerar operación idempotente: nada que borrar
      return NextResponse.json({ success: true, deletedFolderId: folderId, note: 'Carpeta no encontrada (idempotente)' });
    }
    const folderData = folderDoc.data() as any;
    if (folderData.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await deleteFolderRecursive(adminDb, userId, folderId);

    return NextResponse.json({ success: true, deletedFolderId: folderId });
  } catch (error) {
    console.error('Error eliminando carpeta permanentemente:', error);
    const message = (error as any)?.message || 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


