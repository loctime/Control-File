// backend/src/routes/auth-github.js
const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Función para obtener centralAuth (reutilizada del middleware)
function getCentralAuth() {
  try {
    return admin.app('authApp').auth();
  } catch (_) {
    // Si no existe, inicializar (esto debería estar ya inicializado por el middleware)
    throw new Error('Firebase Auth no está inicializado');
  }
}

/**
 * POST /api/auth/github/init
 * Genera una URL de OAuth de GitHub para el usuario autenticado
 * REQUIERE AUTENTICACIÓN mediante header Authorization
 * 
 * Respuesta: { githubAuthUrl: string }
 * 
 * Este es el endpoint RECOMENDADO para uso desde el frontend.
 */
router.post('/init', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Usuario no autenticado',
        code: 'AUTH_REQUIRED'
      });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        error: 'GitHub OAuth no está configurado',
        code: 'OAUTH_NOT_CONFIGURED'
      });
    }

    // Generar state con uid y timestamp
    const state = Buffer.from(
      JSON.stringify({ 
        ts: Date.now(),
        uid: userId
      })
    ).toString('base64');

    const githubAuthUrl =
      'https://github.com/login/oauth/authorize' +
      `?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=repo` +
      `&state=${state}` +
      `&prompt=select_account`;

    return res.json({
      githubAuthUrl,
      success: true
    });
  } catch (error) {
    console.error('Error en /api/auth/github/init:', error);
    return res.status(500).json({
      error: 'Error al generar URL de OAuth',
      code: 'OAUTH_INIT_ERROR'
    });
  }
});

/**
 * GET /api/auth/github
 * Endpoint de compatibilidad: redirige directamente a GitHub OAuth
 * 
 * ⚠️ ADVERTENCIA DE SEGURIDAD:
 * Este endpoint acepta token en query string SOLO para permitir redirects del navegador.
 * El token se valida manualmente y NO se expone en la URL final de GitHub.
 * 
 * Uso recomendado: Usar POST /api/auth/github/init desde el frontend con fetch.
 * Este endpoint GET existe solo para compatibilidad con código legacy.
 * 
 * Query params:
 * - token (opcional): Token de Firebase Auth si viene de redirect del navegador
 */
router.get('/', async (req, res) => {
  try {
    let userId = req.user?.uid; // Si viene del middleware (header)
    
    // Si no hay userId del middleware, intentar obtenerlo del query string
    // Esto permite que funcione con window.location.href
    if (!userId) {
      const token = req.query.token;
      
      if (!token) {
        return res.status(401).json({
          error: 'Token de autorización requerido',
          code: 'AUTH_TOKEN_MISSING',
          hint: 'Use POST /api/auth/github/init con header Authorization, o incluya ?token=... en la URL'
        });
      }

      // Validar token manualmente
      try {
        const centralAuth = getCentralAuth();
        const decoded = await centralAuth.verifyIdToken(token);
        
        if (!decoded || !decoded.uid) {
          return res.status(401).json({
            error: 'Token de usuario inválido',
            code: 'AUTH_UID_MISSING'
          });
        }
        
        userId = decoded.uid;
      } catch (tokenError) {
        console.error('Error validando token:', tokenError);
        if (tokenError.code === 'auth/id-token-expired') {
          return res.status(401).json({
            error: 'Token expirado',
            code: 'AUTH_TOKEN_EXPIRED'
          });
        }
        return res.status(401).json({
          error: 'Token inválido',
          code: 'AUTH_TOKEN_INVALID'
        });
      }
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        error: 'GitHub OAuth no está configurado',
        code: 'OAUTH_NOT_CONFIGURED'
      });
    }

    // ✅ Incluir uid en el state
    const state = Buffer.from(
      JSON.stringify({ 
        ts: Date.now(),
        uid: userId
      })
    ).toString('base64');

    const githubAuthUrl =
      'https://github.com/login/oauth/authorize' +
      `?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=repo` +
      `&state=${state}` +
      `&prompt=select_account`;

    // Redirigir a GitHub
    res.redirect(githubAuthUrl);
  } catch (error) {
    console.error('Error en /api/auth/github:', error);
    return res.status(500).json({
      error: 'Error al iniciar OAuth con GitHub',
      code: 'OAUTH_ERROR'
    });
  }
});

module.exports = router;
