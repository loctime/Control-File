const admin = require('firebase-admin');
const { logger } = require('../../utils/logger');

/**
 * Error personalizado para cuenta no encontrada
 */
class AccountNotFoundError extends Error {
  constructor(uid) {
    super(`Cuenta no encontrada para el usuario ${uid}`);
    this.code = 'ACCOUNT_NOT_FOUND';
    this.statusCode = 404;
    this.uid = uid;
  }
}

/**
 * Error personalizado para cuenta no activa
 */
class AccountNotActiveError extends Error {
  constructor(account) {
    super(`La cuenta no está activa (status: ${account.status})`);
    this.code = 'ACCOUNT_NOT_ACTIVE';
    this.statusCode = 403;
    this.account = account;
  }
}

/**
 * Error personalizado para cuota excedida
 */
class QuotaExceededError extends Error {
  constructor(account, requestedBytes) {
    const available = account.limits.storageBytes;
    super(`Cuota excedida. Solicitado: ${requestedBytes} bytes, Disponible: ${available} bytes`);
    this.code = 'QUOTA_EXCEEDED';
    this.statusCode = 413;
    this.account = account;
    this.requestedBytes = requestedBytes;
    this.availableBytes = available;
  }
}

/**
 * Carga la cuenta desde platform/accounts/{uid}
 * 
 * @param {string} uid - ID del usuario
 * @returns {Promise<Object>} Datos de la cuenta
 * @throws {AccountNotFoundError} Si la cuenta no existe
 */
async function loadAccount(uid) {
  try {
    const db = admin.firestore();
    // Path según especificación: platform/accounts/{uid}
    // Usando la estructura que veo en accounts.js pero simplificada
    const accountRef = db.collection('platform').doc('accounts').collection('accounts').doc(uid);
    const accountDoc = await accountRef.get();
    
    if (!accountDoc.exists) {
      logger.error('Account not found', { uid });
      throw new AccountNotFoundError(uid);
    }
    
    const accountData = accountDoc.data();
    
    // Asegurar que tiene la estructura mínima requerida
    if (!accountData.limits || typeof accountData.limits.storageBytes !== 'number') {
      logger.error('Invalid account structure', { uid, accountData });
      throw new AccountNotFoundError(uid);
    }
    
    return {
      uid,
      ...accountData
    };
  } catch (error) {
    // Re-lanzar errores personalizados
    if (error instanceof AccountNotFoundError) {
      throw error;
    }
    // Otros errores se convierten en error interno
    logger.error('Error loading account', { uid, error: error.message });
    throw error;
  }
}

/**
 * Verifica que la cuenta esté activa
 * 
 * @param {Object} account - Datos de la cuenta
 * @throws {AccountNotActiveError} Si la cuenta no está activa
 */
function requireActiveAccount(account) {
  if (!account) {
    throw new Error('Account is required');
  }
  
  if (account.status !== 'active') {
    logger.warn('Account not active', { uid: account.uid, status: account.status });
    throw new AccountNotActiveError(account);
  }
}

/**
 * Verifica que la acción no exceda la cuota de almacenamiento
 * 
 * NOTA: En esta etapa (v1), limits.storageBytes es un "hard cap" (límite total),
 * no una "quota restante" (disponible). Se valida contra el límite total sin
 * considerar uso actual. La contabilización de uso se implementará más adelante.
 * 
 * @param {Object} account - Datos de la cuenta
 * @param {number} requestedBytes - Bytes solicitados
 * @throws {QuotaExceededError} Si la cuota es excedida
 */
function requireStorage(account, requestedBytes) {
  if (!account) {
    throw new Error('Account is required');
  }
  
  if (typeof requestedBytes !== 'number' || requestedBytes < 0) {
    throw new Error('requestedBytes must be a non-negative number');
  }
  
  if (!account.limits || typeof account.limits.storageBytes !== 'number') {
    logger.error('Invalid account limits', { uid: account.uid, account });
    throw new Error('Account limits are invalid');
  }
  
  const availableBytes = account.limits.storageBytes;
  
  if (requestedBytes > availableBytes) {
    logger.warn('Quota exceeded', { 
      uid: account.uid, 
      requestedBytes, 
      availableBytes 
    });
    throw new QuotaExceededError(account, requestedBytes);
  }
}

module.exports = {
  loadAccount,
  requireActiveAccount,
  requireStorage,
  AccountNotFoundError,
  AccountNotActiveError,
  QuotaExceededError
};
