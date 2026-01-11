// backend/src/services/chat-service.js
// Servicio de chat/query sobre repositorios indexados
// ControlFile actúa como orquestador/proxy - delega completamente el razonamiento LLM a ControlRepo
// SOLO funciona con repositorios en estado 'ready'

const { logger } = require('../utils/logger');
const repositoryStore = require('./repository-store');
const { isValidRepositoryId } = require('../utils/repository-id');
const { queryRepositoryLLM } = require('./controlrepo-llm-client');

/**
 * Procesa una query de chat sobre un repositorio
 * 
 * IMPORTANTE: Este servicio SOLO funciona si el repositorio está en estado 'ready'
 * NO debe ser llamado directamente - debe validarse el estado primero
 * 
 * ControlFile NO implementa lógica LLM propia.
 * Recolecta contexto (index, projectBrain, metrics) y delega completamente a ControlRepo.
 * 
 * @param {string} repositoryId - ID del repositorio
 * @param {string} question - Pregunta del usuario
 * @param {string|null} conversationId - ID de conversación (opcional, para contexto)
 * @returns {Promise<{ response: string, conversationId: string, sources: Array, ... }>}
 */
async function queryRepository(repositoryId, question, conversationId = null) {
  if (!isValidRepositoryId(repositoryId)) {
    throw new Error('repositoryId inválido');
  }
  
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new Error('question es requerida y no puede estar vacía');
  }
  
  logger.info('Procesando query de chat', { repositoryId, questionLength: question.length });
  
  // 1. Verificar que el repositorio existe y está listo
  const status = await repositoryStore.getStatus(repositoryId);
  if (status !== 'ready' && status !== 'completed') {
    throw new Error(`Repositorio no está listo para queries. Estado actual: ${status}`);
  }
  
  // 2. Recolectar contexto completo del repositorio
  const [index, projectBrain, metrics] = await Promise.all([
    repositoryStore.getIndex(repositoryId),
    repositoryStore.getProjectBrain(repositoryId),
    repositoryStore.getMetrics(repositoryId)
  ]);
  
  if (!index) {
    throw new Error(`Índice no encontrado aunque el estado es ${status}`);
  }
  
  // 3. Generar conversationId si no existe
  if (!conversationId) {
    conversationId = `conv-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  
  // 4. Construir conversationMemory (por ahora vacío - puede extenderse en el futuro)
  // TODO: Implementar almacenamiento y recuperación de memoria de conversación si se requiere
  const conversationMemory = [];
  
  // 5. Construir payload según contrato InternalLLMQueryRequest
  const payload = {
    question,
    repositoryId,
    conversationMemory: conversationMemory.length > 0 ? conversationMemory : undefined,
    // role puede agregarse en el futuro si se requiere
    context: {
      index,
      projectBrain: projectBrain || undefined,
      metrics: metrics || undefined
    },
    // options puede agregarse desde el frontend si se requiere
    options: {
      includeDebug: true // Por defecto false, puede venir del frontend
    }
  };
  
  // 6. Delegar completamente a ControlRepo
  logger.info('Delegando consulta LLM a ControlRepo', {
    repositoryId,
    hasIndex: !!index,
    hasProjectBrain: !!projectBrain,
    hasMetrics: !!metrics
  });
  
  let controlRepoResponse;
  try {
    controlRepoResponse = await queryRepositoryLLM(payload);
  } catch (error) {
    // Errores de ControlRepo se propagan como 502 Bad Gateway
    logger.error('Error delegando a ControlRepo', {
      repositoryId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
  
  // 7. Transformar respuesta de ControlRepo al formato del frontend
  // Mantener compatibilidad con contrato actual del frontend
  // pero incluir campos adicionales si están disponibles
  const response = {
    response: controlRepoResponse.answer || '',
    conversationId,
    sources: (controlRepoResponse.files || []).map(file => ({
      path: file.path,
      name: file.name || file.path.split('/').pop(),
      lines: [] // ControlRepo puede proporcionar líneas en el futuro
    }))
  };
  
  // Incluir campos adicionales si están disponibles (para compatibilidad futura)
  if (controlRepoResponse.findings) {
    response.findings = controlRepoResponse.findings;
  }
  
  if (controlRepoResponse.debug) {
    response.debug = controlRepoResponse.debug;
  }
  
  if (controlRepoResponse.timestamp) {
    response.timestamp = controlRepoResponse.timestamp;
  }
  
  logger.info('Query procesada exitosamente', { 
    repositoryId, 
    conversationId,
    responseLength: response.response.length,
    sourcesCount: response.sources.length
  });
  
  return response;
}

module.exports = {
  queryRepository
};
