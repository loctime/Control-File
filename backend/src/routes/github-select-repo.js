const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

/**
 * POST /api/github/select-repo
 * Guarda el repositorio activo del usuario
 *
 * body:
 * {
 *   owner: string,
 *   repo: string,
 *   branch?: string
 * }
 */
router.post('/select-repo', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { owner, repo, branch } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        error: 'owner y repo son obligatorios'
      });
    }

    const db = admin.firestore();

    // ✅ Actualizar en la nueva ruta: apps/controlrepo/{userId}/githubIntegration
    await db
      .doc(`apps/controlrepo/${userId}/githubIntegration`)
      .set(
        {
          selectedRepo: {
            owner,
            repo,
            branch: branch || 'main',
            selectedAt: admin.firestore.FieldValue.serverTimestamp()
          }
        },
        { merge: true }
      );

    return res.json({
      success: true,
      selectedRepo: {
        owner,
        repo,
        branch: branch || 'main'
      }
    });
  } catch (err) {
    console.error('GitHub select repo error:', err);
    return res.status(500).json({
      error: 'Error guardando repositorio seleccionado'
    });
  }
});

module.exports = router;
