// backend/src/services/controlrepo-llm-client.js
// Cliente interno para delegar consultas LLM a ControlRepo
// ControlFile actúa como orquestador/proxy - NO implementa lógica LLM propia

const axios = require('axios');
const { logger } = require('../utils/logger');

const CONTROLREPO_URL = process.env.CONTROLREPO_URL;
const CONTROLFILE_SIGNATURE = process.env.CONTROLFILE_SIGNATURE;

/**
 * Realiza una consulta LLM delegando completamente a ControlRepo
 * 
 * @param {Object} payload - Payload según contrato InternalLLMQueryRequest
 * @param {string} payload.question - Pregunta del usuario
 * @param {string} payload.repositoryId - ID del repositorio
 * @param {Array} payload.conversationMemory - Memoria de conversación (opcional)
 * @param {string} payload.role - Rol del LLM (opcional)
 * @param {Object} payload.context - Contexto completo (index, projectBrain, metrics)
 * @param {Object} payload.options - Opciones adicionales (opcional)
 * @returns {Promise<Object>} Respuesta según contrato InternalLLMQueryResponse
 */
async function queryRepositoryLLM(payload) {
  if (!CONTROLREPO_URL) {
    throw new Error('CONTROLREPO_URL no está configurado en variables de entorno');
  }
  
  if (!CONTROLFILE_SIGNATURE) {
    throw new Error('CONTROLFILE_SIGNATURE no está configurado en variables de entorno');
  }
  
  const url = `${CONTROLREPO_URL}/internal/llm/query`;
  
  logger.info('Delegando consulta LLM a ControlRepo', {
    repositoryId: payload.repositoryId,
    questionLength: payload.question?.length,
    hasConversationMemory: !!payload.conversationMemory?.length,
    hasProjectBrain: !!payload.context?.projectBrain,
    hasMetrics: !!payload.context?.metrics
  });
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-ControlFile-Signature': CONTROLFILE_SIGNATURE
      },
      timeout: 120000, // 2 minutos de timeout para consultas LLM
      validateStatus: (status) => status < 500 // No lanzar error para 4xx, solo para 5xx
    });
    
    // Si ControlRepo retorna error 4xx, propagarlo como 502 Bad Gateway
    if (response.status >= 400 && response.status < 500) {
      logger.error('ControlRepo retornó error 4xx', {
        status: response.status,
        data: response.data,
        repositoryId: payload.repositoryId
      });
      throw new Error(`ControlRepo rechazó la consulta: ${response.data?.message || response.data?.error || 'Error desconocido'}`);
    }
    
    // Si ControlRepo retorna error 5xx, también propagarlo como 502
    if (response.status >= 500) {
      logger.error('ControlRepo retornó error 5xx', {
        status: response.status,
        data: response.data,
        repositoryId: payload.repositoryId
      });
      throw new Error(`ControlRepo reportó error interno: ${response.data?.message || response.data?.error || 'Error desconocido'}`);
    }
    
    logger.info('Consulta LLM completada exitosamente', {
      repositoryId: payload.repositoryId,
      answerLength: response.data?.answer?.length,
      filesCount: response.data?.files?.length,
      hasDebug: !!response.data?.debug
    });
    
    // Retornar respuesta tal cual sin modificar
    return response.data;
    
  } catch (error) {
    // Manejar errores de red o timeout
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.error('Error de conexión con ControlRepo', {
        url,
        error: error.message,
        code: error.code,
        repositoryId: payload.repositoryId
      });
      throw new Error(`No se pudo conectar con ControlRepo: ${error.message}`);
    }
    
    // Si el error ya tiene mensaje (de los throws anteriores), propagarlo
    if (error.message && !error.response) {
      throw error;
    }
    
    // Error inesperado
    logger.error('Error inesperado llamando a ControlRepo', {
      url,
      error: error.message,
      stack: error.stack,
      repositoryId: payload.repositoryId
    });
    throw new Error(`Error llamando a ControlRepo: ${error.message}`);
  }
}

module.exports = {
  queryRepositoryLLM
};
