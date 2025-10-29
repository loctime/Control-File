import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { DocumentSnapshot } from 'firebase-admin/firestore';

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
    const { fileId, newName } = await request.json();

    if (!fileId || !newName) {
      return NextResponse.json({ error: 'ID de archivo y nuevo nombre requeridos' }, { status: 400 });
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

    // Check if new name already exists in the same folder
    const parentId = fileData.parentId || null;
    const existingFileQuery = adminDb.collection('files')
      .where('userId', '==', userId)
      .where('parentId', '==', parentId)
      .where('name', '==', newName)
      .where('type', '==', fileData.type);

    const existingFiles = await existingFileQuery.get();
    
    if (!existingFiles.empty) {
      return NextResponse.json({ error: 'Ya existe un archivo con ese nombre' }, { status: 409 });
    }

    // Update file name
    await fileRef.update({
      name: newName,
      updatedAt: new Date(),
    });

    // If it's a folder, also update all child files
    if (fileData.type === 'folder') {
      const childFilesQuery = adminDb.collection('files')
        .where('userId', '==', userId)
        .where('path', 'array-contains', fileId);

      const childFiles = await childFilesQuery.get();
      
      const batch = adminDb.batch();
      childFiles.docs.forEach((doc: DocumentSnapshot) => {
        const childData = doc.data();
        if (childData && childData.path) {
          const newPath = childData.path.map((id: string) => 
            id === fileId ? fileId : id
          );
          
          batch.update(doc.ref, {
            path: newPath,
            updatedAt: new Date(),
          });
        }
      });
      
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Archivo renombrado exitosamente',
      newName 
    });
  } catch (error) {
    logError(error, 'renaming file');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
