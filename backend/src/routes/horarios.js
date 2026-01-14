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
 * Endpoint público que sirve la imagen del horario semanal.
 * La imagen se busca en Backblaze B2 en la ruta: horarios/{ownerId}/semana-actual.png
 * 
 * Query params:
 * - ownerId (opcional): Si no se proporciona, usa "default"
 * 
 * Respuestas:
 * - 200: Imagen servida exitosamente (Content-Type: image/png)
 * - 404: Horario semanal no disponible
 * - 500: Error interno del servidor
 */
router.get('/semana-actual', async (req, res) => {
  try {
    // Obtener ownerId desde query param, usar "default" si no viene
    const ownerId = typeof req.query.ownerId === 'string' && req.query.ownerId.trim() 
      ? req.query.ownerId.trim() 
      : 'default';

    // Construir la ruta del archivo en Backblaze B2
    const bucketKey = `horarios/${ownerId}/semana-actual.png`;

    logger.debug('Buscando horario semanal', { ownerId, bucketKey });

    // Verificar si el archivo existe antes de intentar obtenerlo
    let fileMetadata;
    try {
      fileMetadata = await b2Service.getObjectMetadata(bucketKey);
    } catch (metadataError) {
      // Si el error es NotFound, el archivo no existe
      if (metadataError.name === 'NotFound' || metadataError.code === 'NotFound') {
        logger.info('Horario semanal no encontrado', { ownerId, bucketKey });
        return res.status(404).json({
          error: 'Horario semanal no disponible',
          code: 'SCHEDULE_NOT_FOUND'
        });
      }
      // Otros errores de B2
      logger.error('Error verificando metadata del horario', {
        error: metadataError.message,
        code: metadataError.code,
        ownerId,
        bucketKey
      });
      throw metadataError;
    }

    if (!fileMetadata) {
      logger.info('Horario semanal no encontrado (metadata null)', { ownerId, bucketKey });
      return res.status(404).json({
        error: 'Horario semanal no disponible',
        code: 'SCHEDULE_NOT_FOUND'
      });
    }

    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=21600');
    res.setHeader('Content-Length', fileMetadata.size || 0);

    // Obtener el stream del archivo desde B2
    const fileStream = await b2Service.getObjectStream(bucketKey);

    // Manejar errores del stream
    fileStream.on('error', (streamError) => {
      logger.error('Error streaming horario desde B2', {
        error: streamError.message,
        code: streamError.code,
        ownerId,
        bucketKey
      });

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Error interno del servidor',
          code: 'STREAM_ERROR'
        });
      }
    });

    // Pipe el stream directamente al cliente
    fileStream.pipe(res);

    logger.debug('Horario semanal servido exitosamente', {
      ownerId,
      bucketKey,
      size: fileMetadata.size
    });

  } catch (error) {
    logger.error('Error en endpoint de horarios', {
      error: error.message,
      code: error.code,
      stack: error.stack,
      ownerId: req.query.ownerId || 'default'
    });

    // Si los headers ya fueron enviados, no podemos enviar una respuesta JSON
    if (res.headersSent) {
      return res.end();
    }

    // Determinar el código de estado apropiado
    let statusCode = 500;
    let errorMessage = 'Error interno del servidor';
    let errorCode = 'INTERNAL_ERROR';

    if (error.name === 'NotFound' || error.code === 'NotFound') {
      statusCode = 404;
      errorMessage = 'Horario semanal no disponible';
      errorCode = 'SCHEDULE_NOT_FOUND';
    }

    res.status(statusCode).json({
      error: errorMessage,
      code: errorCode
    });
  }
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
