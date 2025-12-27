// backend/src/routes/auth-github.js
const express = require('express');
const router = express.Router();

/**
 * GET /api/auth/github
 * Inicia OAuth con GitHub
 */
router.get('/auth/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: 'GitHub OAuth no está configurado'
    });
  }

  // State genérico (anti-CSRF básico)
  const state = Buffer.from(
    JSON.stringify({ ts: Date.now() })
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
