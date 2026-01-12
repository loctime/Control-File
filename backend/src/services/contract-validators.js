/**
 * ⚠️ CONTRATO APP ↔ ControlFile v1 - Helpers Preparatorios
 * 
 * Este archivo contiene stubs y helpers preparatorios para las validaciones
 * del contrato v1. NO implementan validaciones reales todavía.
 * 
 * Estado actual: LEGACY PERMISIVO
 * - El backend actual permite cualquier operación sin restricciones
 * - Estas funciones están preparadas para futuras validaciones
 * - No rompen compatibilidad con apps existentes
 * 
 * Referencia: docs/docs_v2/03_CONTRATOS_TECNICOS/CONTRACT.md
 */

const { logger } = require('../utils/logger');

/**
 * Determina si el caller es ControlFile UI o una app externa
 * 
 * TODO: Implementar detección basada en:
 * - Claims del token (ej: req.claims.appId)
 * - Headers específicos
 * - Origen de la request
 * 
 * @param {Object} req - Express request object
 * @returns {Object} { isControlFileUI: boolean, appId?: string }
 */
function detectCallerType(req) {
  // LEGACY: Por ahora siempre retorna permisivo
  // TODO: Implementar detección real cuando se active el contrato
  return {
    isControlFileUI: true, // Por defecto permisivo
    appId: null
  };
}

/**
 * Valida si una app puede crear carpetas raíz (parentId = null)
 * 
 * CONTRATO v1: Las apps NO pueden crear carpetas raíz
 * Solo ControlFile UI puede crear carpetas raíz (navbar)
 * 
 * @param {Object} req - Express request object
 * @param {string|null} parentId - ID del parent (null = raíz)
 * @returns {Object} { allowed: boolean, reason?: string }
 */
function validateRootFolderCreation(req, parentId) {
  const caller = detectCallerType(req);
  
  // LEGACY: Por ahora siempre permite
  // TODO: Cuando se active el contrato, validar:
  // if (!caller.isControlFileUI && parentId === null) {
  //   return { allowed: false, reason: 'Apps cannot create root folders' };
  // }
  
  return { allowed: true };
}

/**
 * Valida si una app puede crear subcarpetas dentro de un parent
 * 
 * CONTRATO v1: Las apps solo pueden crear subcarpetas dentro de su app root
 * 
 * @param {Object} req - Express request object
 * @param {string} parentId - ID del parent folder
 * @returns {Promise<Object>} { allowed: boolean, reason?: string }
 */
async function validateSubfolderCreation(req, parentId) {
  const caller = detectCallerType(req);
  
  // LEGACY: Por ahora siempre permite
  // TODO: Cuando se active el contrato, validar:
  // 1. Obtener el parent folder
  // 2. Verificar que el parent pertenece a la app del caller
  // 3. Si no pertenece, rechazar
  
  return { allowed: true };
}

/**
 * Valida si una app puede auto-pinnear carpetas en el taskbar
 * 
 * CONTRATO v1: Las apps NO pueden auto-pinnear carpetas
 * Solo ControlFile UI puede agregar items al taskbar
 * 
 * @param {Object} req - Express request object
 * @returns {Object} { allowed: boolean, reason?: string }
 */
function validateTaskbarPin(req) {
  const caller = detectCallerType(req);
  
  // LEGACY: Por ahora siempre permite
  // TODO: Cuando se active el contrato, validar:
  // if (!caller.isControlFileUI) {
  //   return { allowed: false, reason: 'Apps cannot pin folders to taskbar' };
  // }
  
  return { allowed: true };
}

/**
 * Obtiene o crea el app root folder para una aplicación
 * 
 * CONTRATO v1: Las apps deben usar POST /api/apps/:appId/root
 * Este helper será usado por ese endpoint futuro
 * 
 * @param {string} uid - User ID
 * @param {string} appId - Application ID
 * @returns {Promise<Object>} { folderId: string, folderData: Object }
 */
async function ensureAppRootFolder(uid, appId) {
  // TODO: Implementar cuando se cree POST /api/apps/:appId/root
  // 1. Buscar carpeta raíz de la app (marcada con metadata.appId)
  // 2. Si no existe, crearla con parentId=null pero NO visible en navbar
  // 3. Agregarla automáticamente a userSettings.taskbarItems
  // 4. Retornar folderId
  
  throw new Error('ensureAppRootFolder not implemented yet');
}

/**
 * Verifica si una carpeta pertenece a una aplicación específica
 * 
 * @param {string} folderId - Folder ID
 * @param {string} appId - Application ID
 * @returns {Promise<boolean>}
 */
async function folderBelongsToApp(folderId, appId) {
  // TODO: Implementar verificación
  // 1. Obtener el folder
  // 2. Verificar metadata.appId o rastrear ancestros hasta el app root
  // 3. Retornar true si pertenece a la app
  
  return false;
}

module.exports = {
  detectCallerType,
  validateRootFolderCreation,
  validateSubfolderCreation,
  validateTaskbarPin,
  ensureAppRootFolder,
  folderBelongsToApp
};
