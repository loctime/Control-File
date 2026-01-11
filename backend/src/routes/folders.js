const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getFolderDoc } = require('../services/metadata');
const { cacheFolders, invalidateCache } = require('../middleware/cache');
const { logger } = require('../utils/logger');

/**
 * Whitelist de valores permitidos para metadata.source
 */
const ALLOWED_SOURCES = ['navbar', 'taskbar'];

/**
 * Valida y normaliza el valor de source usando whitelist defensiva
 * Si el valor no está en la whitelist, retorna 'navbar' como default seguro
 */
function validateAndNormalizeSource(source) {
  if (!source || typeof source !== 'string') {
    return 'navbar';
  }
  
  const normalizedSource = source.trim().toLowerCase();
  
  if (ALLOWED_SOURCES.includes(normalizedSource)) {
    return normalizedSource;
  }
  
  // Si no está en la whitelist, retornar default seguro
  return 'navbar';
}

// Create folder endpoint
router.post('/create', invalidateCache('create'), async (req, res) => {
  try {
    const { 
      name, 
      parentId, 
      id, 
      icon, 
      color, 
      description, 
      tags, 
      isPublic, 
      customFields,
      source 
    } = req.body;
    const { uid } = req.user;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nombre de carpeta requerido' });
    }

    // Generate folder ID or use provided one
    const folderId = id && typeof id === 'string' && id.trim().length > 0
      ? id
      : `main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate slug
    const baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    let slug = baseSlug;
    
    // Check for slug uniqueness within the same parent
    const filesCol = admin.firestore().collection('files');
    let counter = 1;
    while (true) {
      const existingQuery = await filesCol
        .where('userId', '==', uid)
        .where('parentId', '==', parentId || null)
        .where('slug', '==', slug)
        .where('type', '==', 'folder')
        .limit(1)
        .get();
      
      if (existingQuery.empty) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Calculate path + ancestors
    let path = `/${slug}`;
    let ancestors = [];
    if (parentId) {
      const parent = await getFolderDoc(parentId);
      if (parent) {
        path = `${parent.data.path}${path}`;
        ancestors = Array.isArray(parent.data.ancestors) ? [...parent.data.ancestors, parentId] : [parentId];
      }
    }

    // Create folder in Firestore
    const folderRef = admin.firestore().collection('files').doc(folderId);
    await folderRef.set({
      id: folderId,
      userId: uid,
      name: name.trim(),
      slug: slug,
      parentId: parentId || null,
      path: path,
      ancestors,
      createdAt: new Date(),
      modifiedAt: new Date(),
      type: 'folder',
      metadata: {
        isMainFolder: !parentId,
        isDefault: false,
        icon: icon || 'Folder',
        color: color || 'text-purple-600',
        description: description || '',
        tags: Array.isArray(tags) ? tags : [],
        isPublic: Boolean(isPublic),
        viewCount: 0,
        lastAccessedAt: new Date(),
        permissions: {
          canEdit: true,
          canDelete: true,
          canShare: true,
          canDownload: true
        },
        customFields: customFields || {},
        source: validateAndNormalizeSource(source)
      }
    });

    res.json({ 
      success: true, 
      folderId: folderId,
      slug: slug,
      path: path,
      message: 'Carpeta creada exitosamente'
    });

  } catch (error) {
    logger.error('Error creating folder', { error: error.message, userId: req.user?.uid });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/folders/by-slug/:username/:path
router.get('/by-slug/:username/:path(*)', async (req, res) => {
  try {
    const { username, path } = req.params;
    const { uid } = req.user;

    if (!username || !path) {
      return res.status(400).json({ error: 'Username y path requeridos' });
    }

    // Parse the path to get slug segments
    const pathSegments = path.split('/').filter(segment => segment.trim() !== '');
    
    if (pathSegments.length === 0) {
      return res.status(400).json({ error: 'Path inválido' });
    }

    // Find the user by username
    const usersCol = admin.firestore().collection('users');
    const userQuery = await usersCol
      .where('username', '==', username)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userDoc = userQuery.docs[0];
    const targetUserId = userDoc.id;

    // Check if the folder is public or if user is the owner
    if (targetUserId !== uid) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Navigate through the path to find the target folder
    let currentParentId = null;
    let currentFolder = null;

    for (const slug of pathSegments) {
      const filesCol = admin.firestore().collection('files');
      const folderQuery = await filesCol
        .where('userId', '==', targetUserId)
        .where('parentId', '==', currentParentId)
        .where('slug', '==', slug)
        .where('type', '==', 'folder')
        .limit(1)
        .get();

      if (folderQuery.empty) {
        return res.status(404).json({ error: 'Carpeta no encontrada' });
      }

      currentFolder = folderQuery.docs[0].data();
      currentParentId = currentFolder.id;
    }

    // Update view count
    if (currentFolder) {
      const folderRef = admin.firestore().collection('files').doc(currentFolder.id);
      await folderRef.update({
        'metadata.viewCount': (currentFolder.metadata?.viewCount || 0) + 1,
        'metadata.lastAccessedAt': new Date()
      });
    }

    res.json({
      success: true,
      folder: currentFolder
    });

  } catch (error) {
    logger.error('Error getting folder by slug', { error: error.message, username: req.params.username, path: req.params.path });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Helper: Busca o crea una carpeta raíz por nombre
 * Reutiliza lógica de GET /api/folders/root
 */
async function ensureRootFolder(uid, name) {
  const filesCol = admin.firestore().collection('files');
  
  // Buscar raíz existente
  const existingSnap = await filesCol
    .where('userId', '==', uid)
    .where('parentId', '==', null)
    .where('name', '==', name)
    .where('type', '==', 'folder')
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const doc = existingSnap.docs[0];
    return { folderId: doc.id, folderData: doc.data() };
  }

  // Crear si no existe (reutiliza lógica de /root)
  const generatedId = `main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const folderRef = filesCol.doc(generatedId);
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const path = `/${slug}`;
  
  const doc = {
    id: generatedId,
    userId: uid,
    name,
    slug: slug,
    parentId: null,
    path,
    ancestors: [],
    createdAt: new Date(),
    modifiedAt: new Date(),
    type: 'folder',
    metadata: {
      isMainFolder: true,
      isDefault: true,
      icon: 'Folder',
      color: 'text-purple-600',
      description: '',
      tags: [],
      isPublic: false,
      viewCount: 0,
      lastAccessedAt: new Date(),
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canDownload: true
      },
      customFields: {}
    },
  };

  await folderRef.set(doc);
  return { folderId: generatedId, folderData: doc };
}

/**
 * Helper: Busca o crea una carpeta por slug dentro de un parent
 * Reutiliza lógica de GET /api/folders/by-slug y POST /api/folders/create
 */
async function ensureFolderBySlug(uid, slug, parentId) {
  const filesCol = admin.firestore().collection('files');
  
  // Buscar carpeta existente
  const existingQuery = await filesCol
    .where('userId', '==', uid)
    .where('parentId', '==', parentId)
    .where('slug', '==', slug)
    .where('type', '==', 'folder')
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    const doc = existingQuery.docs[0];
    return { folderId: doc.id, folderData: doc.data() };
  }

  // Crear si no existe (reutiliza lógica de /create)
  const folderId = `main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calcular path y ancestors
  let path = `/${slug}`;
  let ancestors = [];
  if (parentId) {
    const parent = await getFolderDoc(parentId);
    if (parent) {
      path = `${parent.data.path}${path}`;
      ancestors = Array.isArray(parent.data.ancestors) ? [...parent.data.ancestors, parentId] : [parentId];
    }
  }

  const folderRef = filesCol.doc(folderId);
  await folderRef.set({
    id: folderId,
    userId: uid,
    name: slug, // Usar slug como nombre por defecto
    slug: slug,
    parentId: parentId || null,
    path: path,
    ancestors,
    createdAt: new Date(),
    modifiedAt: new Date(),
    type: 'folder',
    metadata: {
      isMainFolder: !parentId,
      isDefault: false,
      icon: 'Folder',
      color: 'text-purple-600',
      description: '',
      tags: [],
      isPublic: false,
      viewCount: 0,
      lastAccessedAt: new Date(),
      permissions: {
        canEdit: true,
        canDelete: true,
        canShare: true,
        canDownload: true
      },
      customFields: {},
      source: 'navbar'
    }
  });

  return { folderId, folderData: await folderRef.get().then(doc => doc.data()) };
}

/**
 * Endpoint de compatibilidad SDK
 * GET /api/folders?path=controldoc/perfil
 * 
 * Acepta path como query param y asegura que exista la carpeta completa.
 * Reutiliza lógica de /root, /by-slug y /create sin duplicar código.
 * 
 * IMPORTANTE: userId se obtiene SIEMPRE de req.user (token), NO de query params
 */
router.get('/', async (req, res) => {
  try {
    const { uid } = req.user;
    const pathParam = req.query.path || req.query.name || '';
    
    if (!uid) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Si no hay path o es solo un nombre, usar lógica de /root
    if (!pathParam || pathParam.trim() === '') {
      // Si no hay path, buscar o crear carpeta raíz con nombre por defecto
      const defaultName = (req.query.name || 'ControlAudit').toString().trim();
      if (!defaultName) {
        return res.status(400).json({ error: 'Path o name requerido' });
      }
      
      const { folderId } = await ensureRootFolder(uid, defaultName);
      return res.json({ folderId });
    }

    // Parsear path en segmentos
    const pathSegments = pathParam.split('/').filter(segment => segment.trim() !== '');
    
    if (pathSegments.length === 0) {
      return res.status(400).json({ error: 'Path inválido' });
    }

    // Navegar/crear cada segmento del path
    let currentParentId = null;
    let currentFolderId = null;

    for (const segment of pathSegments) {
      const slug = segment.toLowerCase().trim();
      
      if (!slug) {
        continue; // Saltar segmentos vacíos
      }

      if (currentParentId === null) {
        // Primer segmento: buscar o crear carpeta raíz
        const { folderId } = await ensureRootFolder(uid, segment);
        currentParentId = folderId;
        currentFolderId = folderId;
      } else {
        // Segmentos siguientes: buscar o crear dentro del parent
        const { folderId } = await ensureFolderBySlug(uid, slug, currentParentId);
        currentParentId = folderId;
        currentFolderId = folderId;
      }
    }

    return res.json({ folderId: currentFolderId });

  } catch (error) {
    logger.error('Error in GET /api/folders (SDK compatibility)', { 
      error: error.message, 
      userId: req.user?.uid,
      path: req.query.path 
    });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Endpoint de compatibilidad SDK (POST)
 * POST /api/folders
 *
 * El SDK espera este endpoint para ensurePath.
 * Internamente delega a la misma lógica que GET /api/folders
 */
router.post('/', async (req, res) => {
  try {
    const { uid } = req.user;
    const pathParam = req.body?.path || req.body?.name || '';

    if (!uid) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (!pathParam || typeof pathParam !== 'string') {
      return res.status(400).json({ error: 'Path requerido' });
    }

    const pathSegments = pathParam.split('/').filter(Boolean);

    let currentParentId = null;
    let currentFolderId = null;

    for (const segment of pathSegments) {
      const slug = segment
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');

      if (!slug) continue;

      if (currentParentId === null) {
        const { folderId } = await ensureRootFolder(uid, segment);
        currentParentId = folderId;
        currentFolderId = folderId;
      } else {
        const { folderId } = await ensureFolderBySlug(uid, slug, currentParentId);
        currentParentId = folderId;
        currentFolderId = folderId;
      }
    }

    return res.json({ folderId: currentFolderId });

  } catch (error) {
    logger.error('Error in POST /api/folders (SDK compatibility)', {
      error: error.message,
      userId: req.user?.uid,
    });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/folders/root?name=ControlAudit&pin=1
router.get('/root', async (req, res) => {
  try {
    const { uid } = req.user;
    const rawName = (req.query.name || 'ControlAudit').toString();
    const name = rawName.trim();
    const shouldPin = String(req.query.pin || '0') === '1';

    if (!name) {
      return res.status(400).json({ error: 'Nombre inválido' });
    }

    const filesCol = admin.firestore().collection('files');

    // Buscar raíz por usuario + parentId null + nombre exacto
    const existingSnap = await filesCol
      .where('userId', '==', uid)
      .where('parentId', '==', null)
      .where('name', '==', name)
      .where('type', '==', 'folder')
      .limit(1)
      .get();

    let folderId;
    let folderData;

    if (!existingSnap.empty) {
      const d = existingSnap.docs[0];
      folderId = d.id;
      folderData = d.data();
    } else {
      // Crear si no existe
      const generatedId = `main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const folderRef = filesCol.doc(generatedId);

      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const path = `/${slug}`;
      const doc = {
        id: generatedId,
        userId: uid,
        name,
        slug: slug,
        parentId: null,
        path,
        ancestors: [],
        createdAt: new Date(),
        modifiedAt: new Date(),
        type: 'folder',
        metadata: {
          isMainFolder: true,
          isDefault: true,
          icon: 'Folder',
          color: 'text-purple-600',
          description: '',
          tags: [],
          isPublic: false,
          viewCount: 0,
          lastAccessedAt: new Date(),
          permissions: {
            canEdit: true,
            canDelete: true,
            canShare: true,
            canDownload: true
          },
          customFields: {}
        },
      };

      await folderRef.set(doc);
      folderId = generatedId;
      folderData = doc;
    }

    // Pin opcional en barra de tareas
    if (shouldPin) {
      const settingsRef = admin.firestore().collection('userSettings').doc(uid);
      await admin.firestore().runTransaction(async (t) => {
        const s = await t.get(settingsRef);
        const current = s.exists ? (s.data() || {}) : {};
        const items = Array.isArray(current.taskbarItems) ? current.taskbarItems : [];
        const exists = items.some((it) => it && it.id === folderId);
        if (!exists) {
          items.push({
            id: folderId,
            name,
            icon: 'Folder',
            color: 'text-purple-600',
            type: 'folder',
            isCustom: true,
          });
          t.set(settingsRef, { taskbarItems: items, updatedAt: new Date() }, { merge: true });
        }
      });
    }

    return res.json({ folderId, folder: { id: folderId, ...folderData } });
  } catch (error) {
    logger.error('Error in GET /api/folders/root', { error: error.message, userId: req.user?.uid });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;