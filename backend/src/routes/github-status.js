const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

/**
 * GET /api/github/status
 * Devuelve si el usuario tiene GitHub conectado con un token válido
 * 
 * Respuesta rápida sin validar contra GitHub API.
 * Solo verifica que existe un access_token válido en Firestore.
 * 
 * Respuesta: { connected: boolean }
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.uid;

    const db = admin.firestore();
    // ✅ Leer desde la nueva ruta: apps/controlrepo/{userId}/githubIntegration
    const doc = await db
      .doc(`apps/controlrepo/${userId}/githubIntegration`)
      .get();

    // Si no existe el documento, no está conectado
    if (!doc.exists) {
      return res.json({
        connected: false
      });
    }

    const data = doc.data();
    const accessToken = data?.access_token;

    // Verificar que existe un token válido (no vacío, no null, no undefined)
    // NO intentamos validar contra GitHub para mantener la respuesta rápida
    const hasValidToken = accessToken && 
                         typeof accessToken === 'string' && 
                         accessToken.trim().length > 0;

    return res.json({
      connected: hasValidToken
    });
  } catch (err) {
    console.error('GitHub status error:', err);
    return res.status(500).json({
      error: 'Error consultando estado de GitHub'
    });
  }
});

module.exports = router;
