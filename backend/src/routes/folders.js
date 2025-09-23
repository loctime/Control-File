const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getAppCode, getFolderDoc } = require('../services/metadata');

// Create folder endpoint
router.post('/create', async (req, res) => {
  try {
    const { name, parentId, id, icon, color } = req.body;
    const { uid } = req.user;
    const APP_CODE = getAppCode();

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nombre de carpeta requerido' });
    }

    // Generate folder ID or use provided one
    const folderId = id && typeof id === 'string' && id.trim().length > 0
      ? id
      : `main-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate path + ancestors
    let path = `/${name.toLowerCase().replace(/\s+/g, '-')}`;
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
        color: color || 'text-purple-600'
      }
    });

    res.json({ 
      success: true, 
      folderId: folderId,
      message: 'Carpeta creada exitosamente'
    });

  } catch (error) {
    console.error('Error creating folder:', error);
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

      const path = `/${name.toLowerCase().replace(/\s+/g, '-')}`;
      const doc = {
        id: generatedId,
        userId: uid,
        name,
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