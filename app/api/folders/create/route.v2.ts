import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDb } from '@/lib/firebase-admin';
import { withAuth, validateRequest, createErrorResponse, createSuccessResponse } from '@/lib/middleware/api-auth';
import { folderCreateSchema } from '@/lib/schemas/api-schemas';
import { logger } from '@/lib/logger';
import { validateAndNormalizeSource } from '@/lib/utils/app-ownership';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    // Validar request body
    const validation = await validateRequest<{
      id: string;
      name: string;
      parentId?: string | null;
      icon?: string;
      color?: string;
      source?: string;
    }>(request, folderCreateSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { id, name, parentId, icon, color, source } = validation.data;

    logger.info('Creating folder', { userId, name, parentId });

    // Get Firestore instance
    const adminDb = requireAdminDb();

    // Check if folder already exists in the same parent
    const existingFolderQuery = adminDb
      .collection('files')
      .where('userId', '==', userId)
      .where('parentId', '==', parentId || null)
      .where('name', '==', name)
      .where('type', '==', 'folder')
      .limit(1);

    const existingFolders = await existingFolderQuery.get();

    if (!existingFolders.empty) {
      logger.warn('Folder already exists', { userId, name, parentId });
      return createErrorResponse(
        'Ya existe una carpeta con ese nombre',
        409,
        'FOLDER_EXISTS'
      );
    }

    // Create slug from name
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');

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
        source: validateAndNormalizeSource(source),
        permissions: {
          canEdit: true,
          canDelete: true,
          canShare: true,
          canDownload: true,
        },
        customFields: {},
      },
    };

    // Save to Firestore
    await adminDb.collection('files').doc(id).set(folderData);

    logger.info('Folder created successfully', { userId, folderId: id, name });

    return createSuccessResponse({
      message: 'Carpeta creada exitosamente',
      folder: folderData,
    });
  } catch (error: any) {
    logger.error('Error creating folder', {
      error: error.message,
      stack: error.stack,
    });
    return createErrorResponse(error);
  }
});

