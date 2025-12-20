const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const b2Service = require('../services/b2');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const path = require('path');

// Configurar multer para manejar multipart/form-data
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB máximo
  }
});

/**
 * Endpoint único de subida para aplicaciones externas
 * POST /upload
 * 
 * Content-Type: multipart/form-data
 * Campos obligatorios:
 *   - file (File)
 *   - auditId (string)
 *   - companyId (string)
 * Campos opcionales:
 *   - sourceApp (string, default: "unknown")
 *   - metadata (string JSON)
 * 
 * Headers requeridos:
 *   - Authorization: Bearer <Firebase ID Token>
 */
router.post('/', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Log inicial de la request
    logger.info('📤 External upload request received', {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
      hasFile: !!req.file,
      bodyFields: Object.keys(req.body || {}),
    });

    // Validar que hay archivo
    if (!req.file) {
      logger.warn('❌ Upload rejected: No file received');
      return res.status(400).json({ 
        error: 'Archivo requerido',
        code: 'FILE_MISSING'
      });
    }

    // Validar campos obligatorios
    const { auditId, companyId } = req.body;
    if (!auditId || !companyId) {
      logger.warn('❌ Upload rejected: Missing required fields', {
        hasAuditId: !!auditId,
        hasCompanyId: !!companyId,
      });
      return res.status(400).json({ 
        error: 'auditId y companyId son obligatorios',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Campos opcionales
    const sourceApp = req.body.sourceApp || 'unknown';
    let metadata = null;
    
    if (req.body.metadata) {
      try {
        metadata = typeof req.body.metadata === 'string' 
          ? JSON.parse(req.body.metadata) 
          : req.body.metadata;
      } catch (e) {
        logger.warn('⚠️ Invalid metadata JSON, ignoring', { error: e.message });
      }
    }

    const { uid, email } = req.user;
    
    logger.info('✅ Token validated', {
      uid,
      email,
      sourceApp,
      auditId,
      companyId,
    });

    // Información del archivo
    const originalFileName = req.file.originalname;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;
    const fileExtension = path.extname(originalFileName).toLowerCase();
    
    logger.info('📄 File received', {
      fileName: originalFileName,
      fileSize,
      mimeType,
      fileExtension,
    });

    // Generar UUID y path en Backblaze
    const fileId = uuidv4();
    const bucketPath = `audits/${companyId}/${auditId}/${fileId}${fileExtension}`;
    
    logger.info('🔧 Generating B2 path', { bucketPath });

    // Subir archivo a Backblaze
    logger.info('⬆️ Uploading to Backblaze B2...', { bucketPath });
    const uploadStartTime = Date.now();
    
    let uploadResult;
    try {
      uploadResult = await b2Service.uploadFileDirectly(
        bucketPath,
        req.file.buffer,
        mimeType
      );
      
      const uploadDuration = Date.now() - uploadStartTime;
      logger.info('✅ File uploaded to B2 successfully', {
        bucketPath,
        etag: uploadResult.etag,
        durationMs: uploadDuration,
      });
    } catch (b2Error) {
      logger.error('❌ B2 upload failed', {
        error: b2Error.message,
        bucketPath,
        fileSize,
      });
      return res.status(500).json({
        error: 'Error al subir archivo a Backblaze',
        code: 'B2_UPLOAD_FAILED'
      });
    }

    // Generar URL pública o presignada
    let fileURL;
    try {
      fileURL = await b2Service.createPresignedGetUrl(bucketPath, 7 * 24 * 3600); // 7 días
      logger.info('🔗 Presigned URL generated', { fileURL: fileURL.substring(0, 50) + '...' });
    } catch (urlError) {
      logger.error('❌ Failed to generate presigned URL', { error: urlError.message });
      // Continuar aunque falle la URL, el archivo ya está subido
      fileURL = `b2://${bucketPath}`;
    }

    // Guardar metadata en Firestore
    const firestoreStartTime = Date.now();
    const fileRef = admin.firestore().collection('files').doc();
    
    const fileData = {
      id: fileRef.id,
      fileId: fileId,
      userId: uid, // Consistencia con el resto del código
      companyId: companyId,
      auditId: auditId,
      name: originalFileName, // Usar 'name' en lugar de 'fileName' para consistencia
      fileName: originalFileName, // Mantener también para compatibilidad
      fileURL: fileURL,
      bucketKey: bucketPath, // Usar 'bucketKey' para consistencia con el código existente
      bucketPath: bucketPath, // Mantener también para referencia
      metadata: metadata || {},
      uploadedBy: uid,
      sourceApp: sourceApp,
      size: fileSize,
      mime: mimeType,
      etag: uploadResult.etag,
      parentId: null, // Archivos externos no tienen parentId
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedAt: null,
    };

    try {
      await fileRef.set(fileData);
      const firestoreDuration = Date.now() - firestoreStartTime;
      
      logger.info('✅ File metadata saved to Firestore', {
        fileId: fileRef.id,
        durationMs: firestoreDuration,
      });
    } catch (firestoreError) {
      logger.error('❌ Firestore write failed', {
        error: firestoreError.message,
        fileId: fileRef.id,
      });
      // El archivo ya está en B2, pero no tenemos metadata
      // Podríamos intentar limpiar B2, pero por ahora solo loggeamos
      return res.status(500).json({
        error: 'Error al guardar metadata en Firestore',
        code: 'FIRESTORE_WRITE_FAILED',
        // Aún así devolvemos el fileId y URL por si acaso
        fileId: fileRef.id,
        fileURL: fileURL,
      });
    }

    // Response exitosa
    const totalDuration = Date.now() - startTime;
    logger.info('✅ Upload completed successfully', {
      fileId: fileRef.id,
      totalDurationMs: totalDuration,
      sourceApp,
      auditId,
      companyId,
    });

    res.status(200).json({
      fileId: fileRef.id,
      fileURL: fileURL,
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    logger.error('❌ Unhandled error in external upload', {
      error: error.message,
      stack: error.stack,
      durationMs: totalDuration,
      userId: req.user?.uid,
    });

    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;

