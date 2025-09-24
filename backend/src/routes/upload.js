const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const b2Service = require('../services/b2');
const multer = require('multer'); // Added multer for file uploads
const { getAppCode, resolveParentAndAncestors } = require('../services/metadata');

// Test endpoint for debugging (no auth required)
router.post('/test-no-auth', async (req, res) => {
  console.log('🧪 Test endpoint (no auth) - Headers:', req.headers);
  console.log('🧪 Test endpoint (no auth) - Body:', req.body);
  res.json({ 
    success: true, 
    body: req.body, 
    headers: req.headers 
  });
});

// Test endpoint for debugging
router.post('/test', async (req, res) => {
  console.log('🧪 Test endpoint - Headers:', req.headers);
  console.log('🧪 Test endpoint - Body:', req.body);
  console.log('🧪 Test endpoint - User:', req.user);
  res.json({ 
    success: true, 
    body: req.body, 
    user: req.user,
    headers: req.headers 
  });
});

// Generate presigned URL for upload
router.post('/presign', async (req, res) => {
  try {
    console.log('📤 Presign request headers:', req.headers);
    console.log('📤 Presign request body:', req.body);
    console.log('📤 Presign request user:', req.user);
    console.log('📤 Content-Type:', req.headers['content-type']);
    
    const {
      name: nameDirect,
      fileName,
      size: sizeDirect,
      fileSize,
      mime: mimeDirect,
      mimeType,
      parentId,
    } = req.body;
    const name = nameDirect || fileName;
    const size = (typeof sizeDirect === 'number' ? sizeDirect : undefined) ?? fileSize;
    const mime = mimeDirect || mimeType;
    const { uid } = req.user;
    const APP_CODE = getAppCode();

    console.log('📤 Parsed data (normalized):', { name, size, mime, parentId, uid });

    if (!name || !size || !mime) {
      console.log('❌ Missing required fields:', { name: !!name, size: !!size, mime: !!mime });
      return res.status(400).json({ error: 'Faltan parámetros requeridos', message: 'name/fileName, size/fileSize y mime/mimeType son obligatorios' });
    }

    // Validate file size (max 5GB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
    if (size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'El archivo es demasiado grande (máx. 5GB)' });
    }

    // Get user quota information
    console.log('📊 Getting user quota for UID:', uid);
    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log('❌ User not found in Firestore:', uid);
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userData = userDoc.data();
    const { planQuotaBytes, usedBytes, pendingBytes } = userData;
    
    console.log('📊 User quota data:', { planQuotaBytes, usedBytes, pendingBytes, requestedSize: size });

    // Check if user has enough quota
    const totalUsed = usedBytes + pendingBytes + size;
    if (totalUsed > planQuotaBytes) {
      return res.status(413).json({ 
        error: 'No tienes suficiente espacio disponible',
        details: {
          requested: size,
          available: planQuotaBytes - usedBytes - pendingBytes,
          total: planQuotaBytes
        }
      });
    }

    // Resolve parent and ancestors (auto-create app root if needed)
    console.log('📁 Resolving parent folder:', { parentId, uid, appCode: APP_CODE });
    const resolved = await resolveParentAndAncestors(uid, parentId);
    const parentPath = resolved.path || '';
    const effectiveParentId = resolved.parentId || parentId || null;
    const ancestors = resolved.ancestors || [];
    console.log('📁 Resolved parent info:', { parentPath, effectiveParentId, ancestors });

    // Generate file key
    const fileKey = generateFileKey(uid, parentPath, name);

    // Check if multipart upload is needed
    const multipartConfig = b2Service.calculateMultipartConfig(size);
    let uploadSessionData = {
      uploadSessionId: Math.random().toString(36).substr(2, 9),
      key: fileKey,
      url: '',
    };

    if (multipartConfig?.useMultipart) {
      // Create multipart upload
      const uploadId = await b2Service.createMultipartUpload(fileKey, mime);
      
      // Generate presigned URLs for each part
      const parts = [];
      for (let i = 1; i <= multipartConfig.totalParts; i++) {
        const partUrl = await b2Service.createPresignedUploadPartUrl(fileKey, uploadId, i);
        parts.push({
          partNumber: i,
          url: partUrl,
        });
      }

      uploadSessionData.multipart = {
        uploadId,
        parts,
      };
    } else {
      // Single upload
      uploadSessionData.url = await b2Service.createPresignedPutUrl(fileKey, 3600, mime);
    }

    // Create upload session in Firestore
    const sessionRef = admin.firestore().collection('uploadSessions').doc(uploadSessionData.uploadSessionId);
    await sessionRef.set({
      uid,
      size,
      parentId: effectiveParentId || null,
      name,
      mime,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      bucketKey: fileKey,
      uploadId: uploadSessionData.multipart?.uploadId || null,
      appCode: APP_CODE,
      ancestors,
    });

    // Asegurar acceso a la carpeta raíz del APP_CODE en la barra de tareas del usuario
    try {
      if (APP_CODE !== 'controlfile' && !parentId && effectiveParentId) {
        const settingsRef = admin.firestore().collection('userSettings').doc(uid);
        await admin.firestore().runTransaction(async (t) => {
          const snap = await t.get(settingsRef);
          const data = snap.exists ? snap.data() : {};
          const items = Array.isArray(data.taskbarItems) ? data.taskbarItems : [];
          const exists = items.some((it) => it && it.id === effectiveParentId);
          if (!exists) {
            items.push({
              id: effectiveParentId,
              name: APP_CODE,
              icon: 'Folder',
              color: 'text-purple-600',
              type: 'folder',
            });
            t.set(settingsRef, { taskbarItems: items, updatedAt: new Date() }, { merge: true });
          }
        });
      }
    } catch (e) {
      console.warn('No se pudo asegurar el acceso del APP_CODE en taskbar:', e);
    }

    // Update user's pending bytes
    await userRef.update({
      pendingBytes: pendingBytes + size,
    });

    res.json(uploadSessionData);
  } catch (error) {
    console.error('Error in presign upload:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Confirm upload completion
router.post('/confirm', async (req, res) => {
  try {
    const { uploadSessionId, etag, parts } = req.body;
    const { uid } = req.user;
    const APP_CODE = getAppCode();

    if (!uploadSessionId) {
      return res.status(400).json({ error: 'ID de sesión requerido' });
    }

    // Get upload session
    const sessionRef = admin.firestore().collection('uploadSessions').doc(uploadSessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Sesión de subida no encontrada' });
    }

    const sessionData = sessionDoc.data();
    if (sessionData.uid !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (sessionData.status !== 'pending' && sessionData.status !== 'uploaded') {
      return res.status(400).json({ error: 'Sesión ya procesada' });
    }

    // Complete multipart upload if needed
    if (sessionData.uploadId && parts) {
      await b2Service.completeMultipartUpload(sessionData.bucketKey, sessionData.uploadId, parts);
    }

    // Verify file exists in B2
    const metadata = await b2Service.getObjectMetadata(sessionData.bucketKey);
    if (!metadata) {
      return res.status(400).json({ error: 'Archivo no encontrado en B2' });
    }

    // Create file record in Firestore
    const fileRef = admin.firestore().collection('files').doc();
    await fileRef.set({
      id: fileRef.id,
      userId: uid, // Cambiar de uid a userId para consistencia
      name: sessionData.name,
      size: sessionData.size,
      mime: sessionData.mime,
      parentId: sessionData.parentId,
      bucketKey: sessionData.bucketKey,
      etag: etag || metadata.etag,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
      appCode: APP_CODE,
      ancestors: Array.isArray(sessionData.ancestors) ? sessionData.ancestors : [],
    });

    // Update user quota
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.update({
      usedBytes: admin.firestore.FieldValue.increment(sessionData.size),
      pendingBytes: admin.firestore.FieldValue.increment(-sessionData.size),
    });

    // Update session status
    await sessionRef.update({
      status: 'completed',
      completedAt: new Date(),
    });

    res.json({ 
      success: true, 
      fileId: fileRef.id,
      message: 'Archivo subido exitosamente'
    });
  } catch (error) {
    console.error('Error confirming upload:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Proxy upload endpoint - recibe archivo y lo sube a B2
router.post('/proxy-upload', multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
  try {
    console.log('📤 Proxy upload request received');
    console.log('📤 File info:', req.file);
    console.log('📤 Session ID:', req.body.sessionId);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    const { sessionId } = req.body;
    const { uid } = req.user;

    if (!sessionId) {
      return res.status(400).json({ error: 'ID de sesión requerido' });
    }

    // Obtener información de la sesión de upload
    const sessionRef = admin.firestore().collection('uploadSessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Sesión de upload no encontrada' });
    }

    const sessionData = sessionDoc.data();
    if (sessionData.uid !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Subir archivo a B2 usando el backend
    const uploadResult = await b2Service.uploadFileDirectly(
      sessionData.bucketKey,
      req.file.buffer,
      req.file.mimetype
    );

    console.log('📤 File uploaded to B2 successfully:', uploadResult);

    // Actualizar estado de la sesión
    await sessionRef.update({
      status: 'uploaded',
      uploadedAt: new Date(),
      etag: uploadResult.etag,
    });

    res.json({ 
      success: true, 
      message: 'Archivo subido correctamente',
      etag: uploadResult.etag 
    });

  } catch (error) {
    console.error('Error in proxy upload:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Helper functions
async function getParentPath(parentId) {
  // Si el parentId es null o vacío, es la carpeta raíz
  if (!parentId) {
    return '';
  }
  
  // Verificar si es una carpeta especial (main-* o sub-*)
  if (parentId.startsWith('main-') || parentId.startsWith('sub-')) {
    // Para carpetas especiales, usar el nombre como path
    // Estas carpetas se manejan en el frontend y no existen en Firestore
    return '';
  }
  
  // Buscar en la colección 'folders'
  const folderRef = admin.firestore().collection('folders').doc(parentId);
  const folderDoc = await folderRef.get();
  
  if (!folderDoc.exists) {
    throw new Error('Carpeta padre no encontrada');
  }
  
  const folderData = folderDoc.data();
  return folderData.path || '';
}

function generateFileKey(userId, parentPath, fileName) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substr(2, 9);
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  if (parentPath) {
    return `${userId}/${parentPath}/${timestamp}_${randomId}_${sanitizedFileName}`;
  }
  
  return `${userId}/${timestamp}_${randomId}_${sanitizedFileName}`;
}

module.exports = router;
