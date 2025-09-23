const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const b2Service = require('../services/b2');
const multer = require('multer');
const archiver = require('archiver');
const { Readable } = require('stream');
const { getAppCode, assertItemVisibleForApp } = require('../services/metadata');

// List files with pagination
router.get('/list', async (req, res) => {
  try {
    const uid = req.user?.uid;
    const APP_CODE = getAppCode();
    const parentIdParam = typeof req.query.parentId === 'string' ? req.query.parentId : undefined;
    const parentId = parentIdParam === 'null' ? null : parentIdParam;
    const limit = Math.min(parseInt(req.query.pageSize || '100', 10), 200);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    // Validar que el usuario esté autenticado
    if (!uid) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    let q = admin.firestore()
      .collection('files')
      .where('userId', '==', uid)
      .where('isDeleted', '==', false);

    if (parentId === null) {
      q = q.where('parentId', '==', null);
    } else if (typeof parentId === 'string' && parentId.length > 0) {
      q = q.where('parentId', '==', parentId);
    }

    if (APP_CODE !== 'controlfile') {
      q = q.where('appCode', '==', APP_CODE);
    }

    q = q.orderBy('updatedAt', 'desc').limit(limit);

    if (cursor) {
      const afterDoc = await admin.firestore().collection('files').doc(cursor).get();
      if (afterDoc.exists) {
        q = q.startAfter(afterDoc);
      }
    }

    const snap = await q.get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const nextPage = snap.size === limit ? (items[items.length - 1]?.id || null) : null;

    return res.json({ items, nextPage });
  } catch (error) {
    console.error('Error listando archivos:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Get presigned URL for download
router.post('/presign-get', async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file from Firestore
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!assertItemVisibleForApp(fileData)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.isDeleted) {
      return res.status(404).json({ error: 'Archivo eliminado' });
    }

    const key = fileData.bucketKey || fileData.key || fileData.objectKey;
    // Fallback: si no hay clave de B2 pero existe una URL absoluta (ej. controlAudit), usarla
    if (!key) {
      if (typeof fileData.url === 'string' && /^https?:\/\//i.test(fileData.url)) {
        console.warn('presign-get: usando URL directa por falta de bucketKey', { fileId, urlHost: (() => { try { return new URL(fileData.url).host; } catch (_) { return 'invalid'; } })() });
        return res.json({
          downloadUrl: fileData.url,
          fileName: fileData.name,
          fileSize: fileData.size,
        });
      }
      console.warn('presign-get: archivo sin bucketKey/key', { fileId, hasBucketKey: !!fileData.bucketKey });
      return res.status(400).json({ error: 'Archivo sin clave de almacenamiento (bucketKey)' });
    }

    // Generate presigned URL
    const downloadUrl = await b2Service.createPresignedGetUrl(key, 300); // 5 minutes

    res.json({ 
      downloadUrl,
      fileName: fileData.name,
      fileSize: fileData.size
    });
  } catch (error) {
    console.error('Error generating download URL:', {
      error: error?.message || error,
      stack: error?.stack,
    });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Delete file
router.post('/delete', async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file from Firestore
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.isDeleted) {
      return res.status(400).json({ error: 'Archivo ya eliminado' });
    }

    // Soft delete - mark as deleted
    await fileRef.update({
      isDeleted: true,
      deletedAt: new Date(),
    });

    // Update user quota
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.update({
      usedBytes: admin.firestore.FieldValue.increment(-fileData.size),
    });

    // Move to trash collection
    const trashRef = admin.firestore().collection('trash').doc(fileId);
    await trashRef.set({
      ...fileData,
      isDeleted: true,
      deletedAt: new Date(),
      originalId: fileId,
    });

    res.json({ 
      success: true,
      message: 'Archivo eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rename file
router.post('/rename', async (req, res) => {
  try {
    const { fileId, newName } = req.body;
    const { uid } = req.user;

    if (!fileId || !newName) {
      return res.status(400).json({ error: 'ID de archivo y nuevo nombre requeridos' });
    }

    // Get file from Firestore
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!assertItemVisibleForApp(fileData)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.isDeleted) {
      return res.status(404).json({ error: 'Archivo eliminado' });
    }

    // Update file name
    await fileRef.update({
      name: newName,
      updatedAt: new Date(),
    });

    res.json({ 
      success: true,
      message: 'Archivo renombrado exitosamente'
    });
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Permanently delete file (from trash)
router.post('/permanent-delete', async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file from trash
    const trashRef = admin.firestore().collection('trash').doc(fileId);
    const trashDoc = await trashRef.get();

    if (!trashDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado en la papelera' });
    }

    const fileData = trashDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!assertItemVisibleForApp(fileData)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Delete from B2
    try {
      await b2Service.deleteObject(fileData.bucketKey);
    } catch (error) {
      console.warn('Error deleting from B2 (file might not exist):', error);
    }

    // Delete from Firestore
    await trashRef.delete();

    // Also delete from files collection if it exists
    const fileRef = admin.firestore().collection('files').doc(fileId);
    await fileRef.delete();

    res.json({ 
      success: true,
      message: 'Archivo eliminado permanentemente'
    });
  } catch (error) {
    console.error('Error permanently deleting file:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Restore file from trash
router.post('/restore', async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file from trash
    const trashRef = admin.firestore().collection('trash').doc(fileId);
    const trashDoc = await trashRef.get();

    if (!trashDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado en la papelera' });
    }

    const fileData = trashDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!assertItemVisibleForApp(fileData)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Check if user has enough quota
    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (userData.usedBytes + fileData.size > userData.planQuotaBytes) {
      return res.status(413).json({ 
        error: 'No tienes suficiente espacio para restaurar este archivo'
      });
    }

    // Restore to files collection
    const fileRef = admin.firestore().collection('files').doc(fileId);
    await fileRef.set({
      ...fileData,
      isDeleted: false,
      deletedAt: null,
      updatedAt: new Date(),
    });

    // Update user quota
    await userRef.update({
      usedBytes: admin.firestore.FieldValue.increment(fileData.size),
    });

    // Delete from trash
    await trashRef.delete();

    res.json({ 
      success: true,
      message: 'Archivo restaurado exitosamente'
    });
  } catch (error) {
    console.error('Error restoring file:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Download multiple files as a ZIP
router.post('/zip', async (req, res) => {
  try {
    const { fileIds, zipName } = req.body || {};
    const { uid } = req.user;
    const APP_CODE = getAppCode();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'Lista de archivos requerida' });
    }
    if (fileIds.length > 200) {
      return res.status(400).json({ error: 'Demasiados archivos seleccionados (máximo 200)' });
    }

    // Cargar metadatos y validar propiedad
    const filesMeta = [];
    for (const fid of fileIds) {
      const fileRef = admin.firestore().collection('files').doc(fid);
      const fileDoc = await fileRef.get();
      if (!fileDoc.exists) {
        continue;
      }
      const data = fileDoc.data();
      if (!data || data.userId !== uid || data.isDeleted || data.type === 'folder') {
        continue;
      }
      if (!assertItemVisibleForApp(data)) {
        continue;
      }
      filesMeta.push({ id: fid, name: data.name || `${fid}`, bucketKey: data.bucketKey });
    }

    if (filesMeta.length === 0) {
      return res.status(404).json({ error: 'No se encontraron archivos válidos' });
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const filename = `${zipName || 'seleccion'}-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    archive.on('error', (err) => {
      console.error('ZIP error:', err);
      try { res.status(500).end(); } catch (_) {}
    });

    archive.pipe(res);

    // Evitar nombres duplicados en el ZIP
    const usedNames = new Map();

    for (const meta of filesMeta) {
      try {
        const presigned = await b2Service.createPresignedGetUrl(meta.bucketKey, 300);
        const response = await fetch(presigned);
        if (!response.ok || !response.body) {
          continue;
        }
        let entryName = meta.name;
        if (usedNames.has(entryName)) {
          const count = usedNames.get(entryName) + 1;
          usedNames.set(entryName, count);
          const dot = entryName.lastIndexOf('.');
          if (dot > 0) {
            entryName = `${entryName.substring(0, dot)} (${count})${entryName.substring(dot)}`;
          } else {
            entryName = `${entryName} (${count})`;
          }
        } else {
          usedNames.set(entryName, 0);
        }

        const nodeStream = typeof Readable.fromWeb === 'function' ? Readable.fromWeb(response.body) : Readable.from(response.body);
        archive.append(nodeStream, { name: entryName });
      } catch (e) {
        console.warn('Error añadiendo archivo al ZIP:', meta.id, e);
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Error creando ZIP:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

// Replace file contents while keeping same metadata/id
router.post('/replace', multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Archivo no recibido' });
    }

    // Load file
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (fileData.isDeleted) {
      return res.status(400).json({ error: 'El archivo está eliminado' });
    }

    if (!assertItemVisibleForApp(fileData)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Upload to same key
    const uploadResult = await b2Service.uploadFileDirectly(
      fileData.bucketKey,
      req.file.buffer,
      req.file.mimetype
    );

    // Update Firestore doc
    const newSize = req.file.size;
    const oldSize = fileData.size || 0;
    await fileRef.update({
      size: newSize,
      mime: req.file.mimetype,
      etag: uploadResult.etag,
      updatedAt: new Date(),
    });

    // Adjust user quota by size delta
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.update({
      usedBytes: admin.firestore.FieldValue.increment(newSize - oldSize),
    });

    res.json({ success: true, message: 'Archivo reemplazado', size: newSize, mime: req.file.mimetype });
  } catch (error) {
    console.error('Error replacing file:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
