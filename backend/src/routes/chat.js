// backend/src/routes/chat.js
// Endpoint POST /chat/query para consultas sobre repositorios indexados
// Valida estado del repositorio antes de responder

const express = require('express');
const { logger } = require('../utils/logger');
const { isValidRepositoryId } = require('../utils/repository-id');
const repositoryStore = require('../services/repository-store');
const { queryRepository } = require('../services/chat-service');

const router = express.Router();

/**
 * POST /chat/query
 * 
 * Procesa una consulta sobre un repositorio indexado
 * 
 * Requisitos:
 * - El repositorio debe estar en estado 'ready'
 * - Si está 'indexing', retorna 202 con mensaje de espera
 * - Si está 'idle' o 'error', retorna 400 con mensaje apropiado
 * 
 * Body JSON:
 * {
 *   "repositoryId": "github:owner:repo",  // REQUERIDO
 *   "question": "¿Cómo funciona X?",      // REQUERIDO
 *   "conversationId": "conv-123"          // OPCIONAL: para contexto continuo
 * }
 * 
 * Respuesta exitosa (200):
 * {
 *   "response": "La respuesta generada...",
 *   "conversationId": "conv-123",
 *   "sources": [
 *     {
 *       "path": "src/auth.ts",
 *       "lines": [10, 25]
 *     }
 *   ]
 * }
 * 
 * Respuesta indexando (202):
 * {
 *   "status": "indexing",
 *   "message": "El repositorio aún se está indexando...",
 *   "estimatedTime": 30
 * }
 * 
 * Respuesta no listo (400):
 * {
 *   "status": "idle" | "error",
 *   "message": "El repositorio no ha sido indexado..."
 * }
 */
router.post('/query', async (req, res) => {
  try {
    const { repositoryId, question, conversationId } = req.body;
    
    // Validar entrada
    if (!repositoryId || typeof repositoryId !== 'string') {
      return res.status(400).json({
        error: 'repositoryId es requerido',
        field: 'repositoryId'
      });
    }
    
    if (!isValidRepositoryId(repositoryId)) {
      return res.status(400).json({
        error: 'repositoryId debe tener formato: github:owner:repo',
        repositoryId
      });
    }
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'question es requerida y no puede estar vacía',
        field: 'question'
      });
    }
    
    // conversationId es opcional
    if (conversationId !== undefined && (typeof conversationId !== 'string' || conversationId.trim().length === 0)) {
      return res.status(400).json({
        error: 'conversationId debe ser string no vacío si se proporciona',
        field: 'conversationId'
      });
    }
    
    logger.info('Query de chat recibida', { 
      repositoryId, 
      questionLength: question.length,
      hasConversationId: !!conversationId
    });
    
    // Verificar estado del repositorio
    const status = await repositoryStore.getStatus(repositoryId);
    
    // Si está indexando, retornar 202
    if (status === 'indexing') {
      logger.info('Repositorio aún indexando, rechazando query', { repositoryId });
      return res.status(202).json({
        status: 'indexing',
        message: 'El repositorio aún se está indexando. Intenta de nuevo en unos momentos.',
        estimatedTime: 30 // TODO: Calcular tiempo real basado en progreso
      });
    }
    
    // Si no está listo, retornar 400
    if (status !== 'ready' && status !== 'completed') {
      let message;
      if (status === 'idle') {
        message = 'El repositorio no ha sido indexado. Primero ejecuta POST /repositories/index';
      } else if (status === 'error') {
        const metadata = await repositoryStore.getMetadata(repositoryId);
        message = `El repositorio tuvo un error durante la indexación: ${metadata?.error || 'Error desconocido'}`;
      } else {
        message = `El repositorio está en estado inesperado: ${status}`;
      }
      
      logger.warn('Query rechazada por estado del repositorio', { repositoryId, status });
      return res.status(400).json({
        status,
        message
      });
    }
    
    // Repositorio está listo, procesar query
    try {
      const result = await queryRepository(repositoryId, question, conversationId || null);
      
      logger.info('Query procesada exitosamente', { 
        repositoryId, 
        conversationId: result.conversationId,
        sourcesCount: result.sources.length
      });
      
      return res.status(200).json(result);
      
    } catch (queryError) {
      logger.error('Error procesando query', { 
        repositoryId, 
        error: queryError.message,
        stack: queryError.stack,
        statusCode: queryError.statusCode
      });
      
      // Si el error viene de ControlRepo con status code 4xx, propagarlo
      if (queryError.statusCode && queryError.statusCode >= 400 && queryError.statusCode < 500) {
        return res.status(queryError.statusCode).json({
          error: 'Error en consulta',
          message: queryError.message,
          ...(queryError.responseData || {})
        });
      }
      
      // Si el error viene de ControlRepo (conexión rechazada o error del servicio),
      // retornar 502 Bad Gateway
      if (queryError.message.includes('ControlRepo') || 
          queryError.message.includes('No se pudo conectar') ||
          queryError.message.includes('reportó error interno')) {
        return res.status(502).json({
          error: 'Error en servicio LLM externo',
          message: queryError.message
        });
      }
      
      // Otros errores se retornan como 500
      return res.status(500).json({
        error: 'Error procesando query',
        message: queryError.message
      });
    }
    
  } catch (error) {
    logger.error('Error en POST /chat/query', { 
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Error en endpoint de chat',
      message: error.message
    });
  }
});

module.exports = router;
