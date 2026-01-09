const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

/**
 * POST /api/github/disconnect
 * Desconecta GitHub del usuario eliminando TODA la información de GitHub
 * 
 * Borra el documento completo: apps/controlrepo/{userId}/githubIntegration
 * 
 * Respuesta: { success: boolean, message: string }
 */
router.post('/disconnect', async (req, res) => {
  try {
    const userId = req.user.uid;

    const db = admin.firestore();
    const integrationRef = db.doc(`apps/controlrepo/${userId}/githubIntegration`);

    // Verificar si existe antes de borrar
    const doc = await integrationRef.get();

    if (!doc.exists) {
      // Ya está desconectado, pero devolvemos éxito
      return res.json({
        success: true,
        message: 'GitHub ya estaba desconectado'
      });
    }

    // Borrar TODO el documento de integración GitHub
    await integrationRef.delete();

    console.log(`[GITHUB] Desconexión completada para usuario ${userId}`);

    return res.json({
      success: true,
      message: 'GitHub desconectado correctamente'
    });
  } catch (err) {
    console.error('GitHub disconnect error:', err);
    return res.status(500).json({
      error: 'Error desconectando GitHub',
      message: err.message
    });
  }
});

module.exports = router;
