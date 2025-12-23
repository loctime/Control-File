import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';
import { logger, logError } from '@/lib/logger-client';
import { 
  normalizeAppId, 
  getOrCreateAppRootFolder, 
  validateParentAppId,
  validateAndNormalizeSource
} from '@/lib/utils/app-ownership';

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
    const { id, name, parentId, icon, color, source, metadata, app } = requestBody;

    // Validación A: app.id es obligatorio
    if (!app || !app.id || typeof app.id !== 'string' || !app.id.trim()) {
      return NextResponse.json(
        { error: 'Missing app.id. Every folder or file must belong to an application.' },
        { status: 400 }
      );
    }

    if (!id || !name) {
      return NextResponse.json({ error: 'ID y nombre son requeridos' }, { status: 400 });
    }

    // Normalización B: app.id se normaliza como slug
    const normalizedAppId = normalizeAppId(app.id);
    const appName = app.name || app.id;

    logger.info('Creating folder', { 
      name, 
      parentId, 
      userId, 
      appId: normalizedAppId,
      appName 
    });

    // Get Firestore instance
    const adminDb = requireAdminDb();

    // Regla D: Si parentId es null, resolver carpeta raíz de la app
    let effectiveParentId: string | null = parentId || null;
    let effectivePath: string[] = [];
    
    if (effectiveParentId === null) {
      // Crear/obtener carpeta raíz de la app
      effectiveParentId = await getOrCreateAppRootFolder(
        adminDb,
        userId,
        normalizedAppId,
        appName
      );
      
      // La carpeta solicitada se crea dentro de la raíz
      const rootDoc = await adminDb.collection('files').doc(effectiveParentId).get();
      if (rootDoc.exists) {
        const rootData = rootDoc.data()!;
        effectivePath = [...(rootData.path || []), effectiveParentId];
      }
    } else {
      // Regla E: Validar que parentId pertenezca a la misma appId
      try {
        await validateParentAppId(adminDb, userId, effectiveParentId, normalizedAppId);
      } catch (error: any) {
        // Logging detallado para debugging de cruces inválidos de app
        logger.error('Invalid app cross-over attempt detected', {
          userId,
          appId: normalizedAppId,
          parentId: effectiveParentId,
          endpoint: '/api/folders/create',
          error: error.message,
          requestName: name,
          requestParentId: parentId,
          timestamp: new Date().toISOString()
        });
        
        return NextResponse.json(
          { error: error.message || 'Parent folder validation failed' },
          { status: 400 }
        );
      }
      
      // Calcular path desde el parent
      const parentDoc = await adminDb.collection('files').doc(effectiveParentId).get();
      if (parentDoc.exists) {
        const parentData = parentDoc.data()!;
        effectivePath = [...(parentData.path || []), effectiveParentId];
      }
    }

    // Check if folder already exists in the same parent (con appId)
    const existingFolderQuery = adminDb.collection('files')
      .where('userId', '==', userId)
      .where('parentId', '==', effectiveParentId)
      .where('name', '==', name)
      .where('type', '==', 'folder')
      .where('appId', '==', normalizedAppId);

    const existingFolders = await existingFolderQuery.get();
    
    if (!existingFolders.empty) {
      return NextResponse.json({ error: 'Ya existe una carpeta con ese nombre' }, { status: 409 });
    }

    // Create slug from name
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

    // Regla F: metadata.source solo define UI - Validación con whitelist defensiva
    const finalSource = validateAndNormalizeSource(metadata?.source || source);

    // Create folder document con appId
    const folderData = {
      id,
      userId,
      name,
      slug,
      parentId: effectiveParentId,
      path: effectivePath,
      type: 'folder',
      appId: normalizedAppId, // Regla 4: Ownership explícito por aplicación
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      metadata: {
        icon: icon || 'Folder',
        color: color || 'text-purple-600',
        isMainFolder: effectiveParentId === null,
        isDefault: false,
        description: '',
        tags: [],
        isPublic: false,
        viewCount: 0,
        lastAccessedAt: new Date(),
        source: finalSource, // Solo UI, no ownership
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

    logger.info('Folder created successfully', { 
      folderId: id, 
      name, 
      userId, 
      appId: normalizedAppId,
      parentId: effectiveParentId 
    });

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
