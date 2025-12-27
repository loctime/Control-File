const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

/**
 * GET /api/github/repos
 * Devuelve repositorios del usuario conectados a GitHub
 */
router.get('/repos', async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = admin.firestore();

    // 1. Obtener integración GitHub
    const integrationSnap = await db
      .collection('githubIntegrations')
      .doc(userId)
      .get();

    if (!integrationSnap.exists) {
      return res.status(400).json({
        error: 'GitHub no conectado'
      });
    }

    const { access_token } = integrationSnap.data();

    if (!access_token) {
      return res.status(400).json({
        error: 'Token GitHub inválido'
      });
    }

    // 2. Llamar a GitHub API
    const ghRes = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'controlfile-backend'
        }
      }
    );

    if (!ghRes.ok) {
      const err = await ghRes.text();
      return res.status(500).json({
        error: 'Error consultando GitHub',
        details: err
      });
    }

    const repos = await ghRes.json();

    // 3. Normalizar salida
    const normalized = repos.map(r => ({
      id: r.id,
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
      private: r.private,
      defaultBranch: r.default_branch,
      updatedAt: r.updated_at
    }));

    return res.json({
      repos: normalized
    });
  } catch (err) {
    console.error('GitHub repos error:', err);
    return res.status(500).json({
      error: 'Error obteniendo repositorios GitHub'
    });
  }
});

module.exports = router;
