// backend/src/routes/auth-github.js
const express = require('express');
const router = express.Router();

/**
 * GET /api/auth/github
 * Inicia OAuth con GitHub
 * REQUIERE AUTENTICACIÓN para obtener el uid del usuario
 */
router.get('/auth/github', (req, res) => {
  const userId = req.user?.uid;
  
  if (!userId) {
    return res.status(401).json({
      error: 'Usuario no autenticado'
    });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: 'GitHub OAuth no está configurado'
    });
  }

  // ✅ Incluir uid en el state
  const state = Buffer.from(
    JSON.stringify({ 
      ts: Date.now(),
      uid: userId  // ✅ Agregar uid al state
    })
  ).toString('base64');

  const githubAuthUrl =
    'https://github.com/login/oauth/authorize' +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=repo` +
    `&state=${state}`;

  res.redirect(githubAuthUrl);
});

module.exports = router;
