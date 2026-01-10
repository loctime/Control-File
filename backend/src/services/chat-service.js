// backend/src/services/chat-service.js
// Servicio de chat/query sobre repositorios indexados
// SOLO funciona con repositorios en estado 'ready'

const { logger } = require('../utils/logger');
const repositoryStore = require('./repository-store');
const { isValidRepositoryId } = require('../utils/repository-id');

/**
 * Procesa una query de chat sobre un repositorio
 * 
 * IMPORTANTE: Este servicio SOLO funciona si el repositorio está en estado 'ready'
 * NO debe ser llamado directamente - debe validarse el estado primero
 * 
 * @param {string} repositoryId - ID del repositorio
 * @param {string} question - Pregunta del usuario
 * @param {string|null} conversationId - ID de conversación (opcional, para contexto)
 * @returns {Promise<{ response: string, conversationId: string, sources: Array }>}
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
  
  // 2. Cargar índice completo (SOLO uso interno - nunca se envía al frontend)
  const index = await repositoryStore.getIndex(repositoryId);
  if (!index) {
    throw new Error(`Índice no encontrado aunque el estado es ${status}`);
  }
  
  // 3. Generar conversationId si no existe
  if (!conversationId) {
    conversationId = `conv-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  
  // 4. Procesar query (implementación básica por ahora)
  // TODO: Integrar con modelo de lenguaje/embedding para respuestas reales
  const response = await processQuery(index, question);
  
  logger.info('Query procesada exitosamente', { 
    repositoryId, 
    conversationId,
    responseLength: response.response.length 
  });
  
  return {
    response: response.response,
    conversationId,
    sources: response.sources || []
  };
}

/**
 * Procesa una query sobre el índice
 * Implementación básica - debe extenderse con modelo de lenguaje real
 * 
 * @param {Object} index - Índice completo del repositorio
 * @param {string} question - Pregunta del usuario
 * @returns {Promise<{ response: string, sources: Array }>}
 */
async function processQuery(index, question) {
  // Implementación básica: búsqueda simple por palabras clave
  // TODO: Reemplazar con embedding search o modelo de lenguaje
  
  const questionLower = question.toLowerCase();
  const questionWords = questionLower.split(/\s+/);
  
  // Buscar archivos relevantes
  const relevantFiles = [];
  const files = index.files || [];
  
  for (const file of files) {
    const filePath = (file.path || '').toLowerCase();
    const fileContent = (file.content || '').toLowerCase();
    
    // Buscar coincidencias en path o contenido
    const matchesInPath = questionWords.filter(word => filePath.includes(word)).length;
    const matchesInContent = questionWords.filter(word => fileContent.includes(word)).length;
    
    if (matchesInPath > 0 || matchesInContent > 0) {
      relevantFiles.push({
        file,
        relevance: matchesInPath * 2 + matchesInContent, // Path matches son más importantes
        matches: matchesInPath + matchesInContent
      });
    }
  }
  
  // Ordenar por relevancia
  relevantFiles.sort((a, b) => b.relevance - a.relevance);
  
  // Tomar los 3 archivos más relevantes
  const topFiles = relevantFiles.slice(0, 3);
  
  // Generar respuesta básica
  let response = `Basándome en el repositorio, encontré ${relevantFiles.length} archivo(s) relevante(s).\n\n`;
  
  if (topFiles.length > 0) {
    response += 'Los archivos más relevantes son:\n';
    topFiles.forEach((item, index) => {
      response += `${index + 1}. ${item.file.path}\n`;
    });
    response += '\n';
    response += 'Para obtener una respuesta más detallada, integre un modelo de lenguaje (OpenAI, Anthropic, etc.).';
  } else {
    response += 'No se encontraron archivos específicos relacionados con tu pregunta. Intenta reformular o ser más específico.';
  }
  
  // Generar fuentes
  const sources = topFiles.map(item => ({
    path: item.file.path,
    lines: [1, 50] // TODO: Calcular líneas reales donde aparece la información
  }));
  
  return {
    response: response.trim(),
    sources
  };
}

module.exports = {
  queryRepository
};
