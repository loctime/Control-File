const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getAppCode, getFolderDoc } = require('../services/metadata');

// Create folder endpoint
router.post('/create', async (req, res) => {
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
      customFields 
    } = req.body;
    const { uid } = req.user;
    const APP_CODE = getAppCode();

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
    const foldersCol = admin.firestore().collection('folders');
    let counter = 1;
    while (true) {
      const existingQuery = await foldersCol
        .where('userId', '==', uid)
        .where('parentId', '==', parentId || null)
        .where('slug', '==', slug)
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
    const folderRef = admin.firestore().collection('folders').doc(folderId);
    await folderRef.set({
      id: folderId,
      userId: uid,
      name: name.trim(),
      slug: slug,
      parentId: parentId || null,
      path: path,
      appCode: APP_CODE,
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
        customFields: customFields || {}
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
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/folders/by-slug/:username/:path
router.get('/by-slug/:username/:path(*)', async (req, res) => {
  try {
    const { username, path } = req.params;
    const { uid } = req.user;
    const APP_CODE = getAppCode();

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
      // TODO: Implement public folder access logic
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Navigate through the path to find the target folder
    let currentParentId = null;
    let currentFolder = null;

    for (const slug of pathSegments) {
      const foldersCol = admin.firestore().collection('folders');
      const folderQuery = await foldersCol
        .where('userId', '==', targetUserId)
        .where('parentId', '==', currentParentId)
        .where('slug', '==', slug)
        .where('appCode', '==', APP_CODE)
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
      const folderRef = admin.firestore().collection('folders').doc(currentFolder.id);
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
    console.error('Error getting folder by slug:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

// GET /api/folders/root?name=ControlAudit&pin=1
router.get('/root', async (req, res) => {
  try {
    const { uid } = req.user;
    const rawName = (req.query.name || 'ControlAudit').toString();
    const name = rawName.trim();
    const shouldPin = String(req.query.pin || '0') === '1';
    const APP_CODE = getAppCode();

    if (!name) {
      return res.status(400).json({ error: 'Nombre inválido' });
    }

    const foldersCol = admin.firestore().collection('folders');

    // Buscar raíz por usuario + parentId null + nombre exacto
    const existingSnap = await foldersCol
      .where('userId', '==', uid)
      .where('parentId', '==', null)
      .where('name', '==', name)
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
      const folderRef = foldersCol.doc(generatedId);

      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const path = `/${slug}`;
      const doc = {
        id: generatedId,
        userId: uid,
        name,
        slug: slug,
        parentId: null,
        path,
        appCode: APP_CODE,
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
    console.error('Error en GET /api/folders/root:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});