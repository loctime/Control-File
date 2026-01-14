const express = require('express');
const router = express.Router();
const b2Service = require('../services/b2');
const { logger } = require('../utils/logger');

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

module.exports = router;
