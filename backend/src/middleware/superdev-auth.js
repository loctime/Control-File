/**
 * Middleware de autenticación para endpoints Superdev
 * 
 * Utilidad compartida para validar custom claim superdev: true
 * en endpoints exclusivos para desarrolladores.
 */

const admin = require('firebase-admin');

/**
 * Obtiene la instancia de Auth central (authApp)
 */
function getCentralAuth() {
  try {
    return admin.app('authApp').auth();
  } catch (error) {
    throw new Error('Auth central no está inicializado');
  }
}

/**
 * Middleware Express para verificar permisos de superdev
 * 
 * Verifica que el usuario tenga custom claim superdev: true
 * 
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No autorizado: token requerido',
        code: 'UNAUTHORIZED',
      });
    }

    const token = authHeader.slice(7);
    const centralAuth = getCentralAuth();
    const decoded = await centralAuth.verifyIdToken(token);

    // Verificar custom claim superdev
    if (decoded.superdev !== true) {
      return res.status(403).json({
        error: 'No autorizado: se requieren permisos de superdev',
        code: 'FORBIDDEN',
      });
    }

    // Agregar información del superdev al request
    req.superdev = {
      uid: decoded.uid,
      email: decoded.email,
    };

    return next();
  } catch (error) {
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED',
      });
    }

    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        error: 'Token revocado',
        code: 'TOKEN_REVOKED',
      });
    }

    return res.status(401).json({
      error: 'No autorizado: token inválido',
      code: 'UNAUTHORIZED',
    });
  }
};
