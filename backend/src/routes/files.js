const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const b2Service = require('../services/b2');
const multer = require('multer');
const archiver = require('archiver');
const { Readable } = require('stream');
// Función simple para verificar visibilidad de items
const assertItemVisibleForApp = (itemData) => {
  // Por ahora, todos los items son visibles
  return true;
};
const { cacheFiles, invalidateCache } = require('../middleware/cache');

// List files and folders with pagination (with TanStack cache)
router.get('/list', cacheFiles, async (req, res) => {
  try {
    const uid = req.user?.uid;
    const parentIdParam = typeof req.query.parentId === 'string' ? req.query.parentId : undefined;
    const parentId = parentIdParam === 'null' ? null : parentIdParam;
    const limit = Math.min(parseInt(req.query.pageSize || '100', 10), 200);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    // Validar que el usuario esté autenticado
    if (!uid) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Si tenemos datos en cache, usarlos
    if (req.cachedFiles && req.cacheHit) {
      console.log('🚀 Using cached files data');
      return res.json({
        success: true,
        data: req.cachedFiles,
        message: 'Files retrieved from cache',
        cacheHit: true
      });
    }

    const items = [];

    try {
      // Get files from 'files' collection
      let filesQuery = admin.firestore()
        .collection('files')
        .where('userId', '==', uid)
        .where('isDeleted', '==', false);

      if (parentId === null) {
        filesQuery = filesQuery.where('parentId', '==', null);
      } else if (typeof parentId === 'string' && parentId.length > 0) {
        filesQuery = filesQuery.where('parentId', '==', parentId);
      }

      // Ya no filtramos por appCode - todos los archivos del usuario

      filesQuery = filesQuery.orderBy('updatedAt', 'desc');

      if (cursor) {
        const afterDoc = await admin.firestore().collection('files').doc(cursor).get();
        if (afterDoc.exists) {
          filesQuery = filesQuery.startAfter(afterDoc);
        }
      }

      const filesSnap = await filesQuery.limit(limit).get();
      filesSnap.forEach(doc => {
        items.push({ 
          id: doc.id, 
          ...doc.data(),
          type: 'file' // Asegurar que tenga el tipo correcto
        });
      });

    } catch (filesError) {
      console.warn('Error consultando archivos:', filesError.message);
    }

    try {
      // Get folders from 'files' collection
      let foldersQuery = admin.firestore()
        .collection('files')
        .where('userId', '==', uid)
        .where('type', '==', 'folder');

      if (parentId === null) {
        foldersQuery = foldersQuery.where('parentId', '==', null);
      } else if (typeof parentId === 'string' && parentId.length > 0) {
        foldersQuery = foldersQuery.where('parentId', '==', parentId);
      }

      // Ya no filtramos por appCode - todas las carpetas del usuario

      foldersQuery = foldersQuery.orderBy('createdAt', 'desc');

      const foldersSnap = await foldersQuery.limit(limit).get();
      foldersSnap.forEach(doc => {
        const data = doc.data();
        items.push({ 
          id: doc.id, 
          ...data,
          type: 'folder', // Asegurar que tenga el tipo correcto
          updatedAt: data.modifiedAt || data.createdAt // Usar modifiedAt como updatedAt para consistencia
        });
      });

    } catch (foldersError) {
      console.warn('Error consultando carpetas de files:', foldersError.message);
    }

    // Solo leer de files collection (enfoque unificado)

    // Ordenar todos los items por updatedAt/modifiedAt descendente
    items.sort((a, b) => {
      const aTime = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 
                   a.modifiedAt?.toDate ? a.modifiedAt.toDate().getTime() : 
                   a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bTime = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 
                   b.modifiedAt?.toDate ? b.modifiedAt.toDate().getTime() : 
                   b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bTime - aTime;
    });

    // Aplicar límite después de combinar
    const limitedItems = items.slice(0, limit);
    const nextPage = limitedItems.length === limit ? (limitedItems[limitedItems.length - 1]?.id || null) : null;

    return res.json({ items: limitedItems, nextPage });
  } catch (error) {
    console.error('Error listando archivos y carpetas:', error);
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
router.post('/delete', invalidateCache('delete'), async (req, res) => {
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

    if (fileData.deletedAt) {
      return res.status(400).json({ error: 'Archivo ya eliminado' });
    }

    // Soft delete - mark as deleted
    await fileRef.update({
      deletedAt: new Date(),
    });

    // Update user quota
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.update({
      usedBytes: admin.firestore.FieldValue.increment(-fileData.size),
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
router.post('/rename', invalidateCache('update'), async (req, res) => {
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
router.post('/permanent-delete', invalidateCache('delete'), async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file from files collection
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!fileData.deletedAt) {
      return res.status(400).json({ error: 'Archivo no está en la papelera' });
    }

    // Delete from B2
    try {
      await b2Service.deleteObject(fileData.bucketKey);
    } catch (error) {
      console.warn('Error deleting from B2 (file might not exist):', error);
    }

    // Delete from Firestore
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
router.post('/restore', invalidateCache('create'), async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file from files collection
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!fileData.deletedAt) {
      return res.status(400).json({ error: 'Archivo no está en la papelera' });
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

    // Restore file
    await fileRef.update({
      deletedAt: null,
      updatedAt: new Date(),
    });

    // Update user quota
    await userRef.update({
      usedBytes: admin.firestore.FieldValue.increment(fileData.size),
    });

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
    // APP_CODE eliminado

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

// OCR y Conversión deshabilitados - Requieren tarjeta de crédito en Cloudmersive
// Para habilitar: agregar tarjeta en https://cloudmersive.com y descomentar estos endpoints

/*
// OCR - Extract text from image/PDF
router.post('/ocr', async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file
    const fileDoc = await admin.firestore().collection('files').doc(fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.isDeleted) {
      return res.status(400).json({ error: 'Archivo eliminado' });
    }

    // Verificar tipo de archivo
    const supportedTypes = ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf'];
    if (!supportedTypes.includes(fileData.mime)) {
      return res.status(400).json({ error: 'Tipo de archivo no soportado para OCR' });
    }

    // Descargar archivo de B2
    const fileBuffer = await b2Service.getObjectBuffer(fileData.bucketKey || fileData.key);

    // Ejecutar OCR
    const cloudmersive = require('../services/cloudmersive');
    if (!cloudmersive.enabled) {
      return res.status(503).json({ error: 'Servicio de OCR no disponible' });
    }

    const ocrResult = await cloudmersive.extractText(fileBuffer, fileData.mime);

    // Guardar resultado en Firestore
    await admin.firestore().collection('files').doc(fileId).update({
      ocr: {
        processed: true,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        processedAt: ocrResult.processedAt
      }
    });

    res.json({
      success: true,
      text: ocrResult.text,
      confidence: ocrResult.confidence
    });

  } catch (error) {
    console.error('Error in OCR:', error);
    res.status(500).json({ error: 'Error al extraer texto' });
  }
});

// Convert to PDF
router.post('/convert-to-pdf', async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    const fileDoc = await admin.firestore().collection('files').doc(fileId).get();
    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.isDeleted) {
      return res.status(400).json({ error: 'Archivo eliminado' });
    }

    // Tipos soportados
    const officeFormats = {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
    };

    if (!officeFormats[fileData.mime]) {
      return res.status(400).json({ error: 'Solo archivos Office son soportados' });
    }

    // Descargar archivo
    const fileBuffer = await b2Service.getObjectBuffer(fileData.bucketKey || fileData.key);

    // Convertir
    const cloudmersive = require('../services/cloudmersive');
    if (!cloudmersive.enabled) {
      return res.status(503).json({ error: 'Servicio de conversión no disponible' });
    }

    let pdfBuffer;
    
    if (fileData.mime.includes('word')) {
      pdfBuffer = await cloudmersive.convertDocxToPdf(fileBuffer);
    } else if (fileData.mime.includes('spreadsheet')) {
      pdfBuffer = await cloudmersive.convertXlsxToPdf(fileBuffer);
    } else if (fileData.mime.includes('presentation')) {
      pdfBuffer = await cloudmersive.convertPptxToPdf(fileBuffer);
    }

    // Subir PDF
    const pdfName = fileData.name.replace(/\.\w+$/, '.pdf');
    const pdfKey = `${uid}/${Date.now()}_${pdfName}`;
    
    await b2Service.uploadFileDirectly(pdfKey, pdfBuffer, 'application/pdf');

    // Crear registro en Firestore
    const newFileRef = admin.firestore().collection('files').doc();
    await newFileRef.set({
      id: newFileRef.id,
      userId: uid,
      name: pdfName,
      bucketKey: pdfKey,
      key: pdfKey,
      size: pdfBuffer.length,
      mime: 'application/pdf',
      parentId: fileData.parentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      // appCode eliminado
    });

    res.json({
      success: true,
      message: 'Archivo convertido a PDF',
      fileId: newFileRef.id,
      fileName: pdfName
    });

  } catch (error) {
    console.error('Error converting to PDF:', error);
    res.status(500).json({ error: 'Error al convertir archivo' });
  }
});
*/

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
