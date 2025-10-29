import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { logger, logError } from '@/lib/logger-client';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    logger.info('API create folder endpoint called');
    
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
    const requestBody = await request.json();
    const { id, name, parentId, icon, color, source, metadata } = requestBody;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID y nombre son requeridos' }, { status: 400 });
    }

    // DEBUG: Log completo del request
    logger.debug('Request body completo', { requestBody });
    logger.debug('metadata extraído', { metadata });
    logger.debug('source extraído', { source });
    logger.debug('source del requestBody', { source: requestBody.source });

    // ARREGLADO: Usar source de metadata si existe, sino del nivel raíz, sino 'navbar'
    const finalSource = metadata?.source || source || 'navbar';
    logger.info('Creating folder', { name, parentId, userId, finalSource, metadataSource: metadata?.source, rootSource: source });

    // Get Firestore instance
    const adminDb = requireAdminDb();

    // Check if folder already exists in the same parent
    const existingFolderQuery = adminDb.collection('files')
      .where('userId', '==', userId)
      .where('parentId', '==', parentId || null)
      .where('name', '==', name)
      .where('type', '==', 'folder');

    const existingFolders = await existingFolderQuery.get();
    
    if (!existingFolders.empty) {
      return NextResponse.json({ error: 'Ya existe una carpeta con ese nombre' }, { status: 409 });
    }

    // Create slug from name
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    // Calculate path
    let path: string[] = [];
    if (parentId) {
      const parentDoc = await adminDb.collection('files').doc(parentId).get();
      if (parentDoc.exists) {
        const parentData = parentDoc.data();
        path = [...(parentData?.path || []), parentId];
      }
    }

    // Create folder document
    const folderData = {
      id,
      userId,
      name,
      slug,
      parentId: parentId || null,
      path,
      type: 'folder',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      metadata: {
        icon: icon || 'Folder',
        color: color || 'text-purple-600',
        isMainFolder: !parentId,
        isDefault: false,
        description: '',
        tags: [],
        isPublic: false,
        viewCount: 0,
        lastAccessedAt: new Date(),
        source: finalSource,
        permissions: {
          canEdit: true,
          canDelete: true,
          canShare: true,
          canDownload: true
        },
        customFields: {}
      }
    };

    // Save to Firestore
    await adminDb.collection('files').doc(id).set(folderData);

    logger.info('Folder created successfully', { folderId: id, name, userId });

    return NextResponse.json({ 
      success: true, 
      message: 'Carpeta creada exitosamente',
      folder: folderData
    });
  } catch (error) {
    logError(error, 'creating folder', { userId: request.headers.get('authorization') ? 'authenticated' : 'anonymous' });
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
