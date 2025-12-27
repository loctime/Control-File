const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

/**
 * GET /api/github/repos
 * Lista repositorios del usuario autenticado
 */
router.get('/repos', async (req, res) => {
  try {
    // authMiddleware ya dejó req.user
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const db = admin.firestore();

    // 1️⃣ Obtener token GitHub del usuario
    const tokenDoc = await db
      .collection('githubIntegrations')
      .doc(userId)
      .get();

    if (!tokenDoc.exists) {
      return res.status(404).json({
        error: 'GitHub no conectado para este usuario'
      });
    }

    const { accessToken } = tokenDoc.data();

    if (!accessToken) {
      return res.status(400).json({
        error: 'Token GitHub inválido'
      });
    }

    // 2️⃣ Llamar a GitHub API
    const response = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=updated',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ControlFile'
        }
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: 'Error consultando GitHub',
        details: errorBody
      });
    }

    const repos = await response.json();

    // 3️⃣ Normalizar respuesta (solo lo necesario)
    const normalized = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      owner: repo.owner.login,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      url: repo.html_url,
      cloneUrl: repo.clone_url
    }));

    return res.json({
      count: normalized.length,
      repos: normalized
    });
  } catch (err) {
    console.error('Error listando repos GitHub:', err);
    return res.status(500).json({
      error: 'Error interno listando repos GitHub'
    });
  }
});

module.exports = router;
