const express = require('express');
const router = express.Router();
const multer = require('multer');
const b2Service = require('../services/b2');
const { logger } = require('../utils/logger');

// Configurar multer para manejar multipart/form-data
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB máximo para imágenes de horario
  },
  fileFilter: (req, file, cb) => {
    // Solo permitir imágenes PNG
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PNG'), false);
    }
  }
});

/**
 * GET /api/horarios/semana-actual?ownerId=xxx
 * 
 * Endpoint público que devuelve la URL pública del horario semanal.
 * La imagen se busca en Backblaze B2 en la ruta: horarios/{ownerId}/semana-actual.png
 * 
 * Query params:
 * - ownerId (obligatorio): ID del propietario
 * 
 * Respuestas:
 * - 200: JSON con { url: <public B2 URL> }
 * - 400: ownerId no proporcionado
 * - 500: B2_PUBLIC_BASE_URL no configurada
 */
router.get('/semana-actual', async (req, res) => {
  const ownerId = typeof req.query.ownerId === 'string' && req.query.ownerId.trim()
    ? req.query.ownerId.trim()
    : null;

  if (!ownerId) {
    return res.status(400).json({
      error: 'ownerId es obligatorio',
      code: 'OWNER_ID_REQUIRED'
    });
  }

  const B2_PUBLIC_BASE_URL = process.env.B2_PUBLIC_BASE_URL;
  
  if (!B2_PUBLIC_BASE_URL) {
    logger.error('B2_PUBLIC_BASE_URL no configurada en GET /semana-actual');
    return res.status(500).json({
      error: 'B2_PUBLIC_BASE_URL no configurada',
      code: 'CONFIG_ERROR'
    });
  }
  
  // Normalizar B2_PUBLIC_BASE_URL: eliminar barra final si existe
  const baseUrl = B2_PUBLIC_BASE_URL.replace(/\/$/, '');
  
  // Construir URL usando B2_PUBLIC_BASE_URL (nunca URLs directas de Backblaze)
  const publicUrl = `${baseUrl}/horarios/${ownerId}/semana-actual.png`;
  
  // Log explícito con la URL final devuelta
  logger.info('GET /semana-actual: URL generada', {
    ownerId,
    baseUrl: B2_PUBLIC_BASE_URL,
    finalUrl: publicUrl
  });
  
  res.json({ url: publicUrl });
});

/**
 * POST /api/horarios/semana-actual
 * 
 * Endpoint para subir/actualizar la imagen del horario semanal.
 * La imagen se guarda en Backblaze B2 en la ruta: horarios/{ownerId}/semana-actual.png
 * 
 * Content-Type: multipart/form-data
 * Campos:
 * - file (File, requerido): Archivo PNG con el horario semanal
 * - ownerId (string, opcional): ID del propietario. Si no se proporciona, usa "default"
 * 
 * Respuestas:
 * - 200: Horario subido exitosamente
 * - 400: Error de validación (archivo faltante, formato incorrecto, etc.)
 * - 500: Error interno del servidor
 */
router.post('/semana-actual', upload.single('file'), async (req, res) => {
  try {
    // Validar que hay archivo
    if (!req.file) {
      logger.warn('POST /semana-actual: No file received');
      return res.status(400).json({
        error: 'Archivo requerido',
        code: 'FILE_MISSING'
      });
    }

    // Validar que es PNG
    if (req.file.mimetype !== 'image/png') {
      logger.warn('POST /semana-actual: Invalid file type', {
        mimetype: req.file.mimetype
      });
      return res.status(400).json({
        error: 'Solo se permiten archivos PNG',
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Obtener ownerId desde body o query, usar "default" si no viene
    const ownerId = (req.body.ownerId || req.query.ownerId || 'default').trim();

    // Construir la ruta del archivo en Backblaze B2
    const bucketKey = `horarios/${ownerId}/semana-actual.png`;

    logger.info('Subiendo horario semanal', {
      ownerId,
      bucketKey,
      fileSize: req.file.size,
      mimetype: req.file.mimetype
    });

    // Subir el archivo a B2
    await b2Service.uploadFileDirectly(
      bucketKey,
      req.file.buffer,
      'image/png'
    );

    logger.info('Horario semanal subido exitosamente', {
      ownerId,
      bucketKey,
      fileSize: req.file.size
    });

    res.status(200).json({
      success: true,
      message: 'Horario semanal actualizado exitosamente',
      ownerId,
      bucketKey,
      fileSize: req.file.size
    });

  } catch (error) {
    logger.error('Error subiendo horario semanal', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      ownerId: req.body?.ownerId || req.query?.ownerId || 'default'
    });

    // Si es un error de multer (tamaño de archivo, etc.)
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'El archivo es demasiado grande (máx. 10MB)',
          code: 'FILE_TOO_LARGE'
        });
      }
      return res.status(400).json({
        error: 'Error procesando archivo',
        code: 'UPLOAD_ERROR',
        message: error.message
      });
    }

    // Si es el error de validación de tipo de archivo
    if (error.message === 'Solo se permiten archivos PNG') {
      return res.status(400).json({
        error: error.message,
        code: 'INVALID_FILE_TYPE'
      });
    }

    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
