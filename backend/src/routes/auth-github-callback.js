const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(
        `${process.env.REPO_FRONTEND_URL}/github-error?reason=${error}`
      );
    }

    if (!code || !state) {
      return res.status(400).json({
        error: 'Parámetros OAuth inválidos'
      });
    }

    // Decodificar state para obtener uid
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'State inválido' });
    }

    const { uid } = stateData;
    if (!uid) {
      return res.status(400).json({ error: 'UID no encontrado en state' });
    }

    // Intercambiar code por access_token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(500).json({
        error: 'No se pudo obtener access_token de GitHub',
        details: tokenData
      });
    }

    // ✅ Guardar token en la ruta correcta para ControlRepo
    const db = admin.firestore();
    await db
      .doc(`apps/controlrepo/${uid}/githubIntegration`)
      .set({
        access_token: tokenData.access_token,
        provider: 'github',
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Opcional: guardar refresh_token si GitHub lo proporciona
        ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token }),
        ...(tokenData.expires_in && { expiresIn: tokenData.expires_in })
      }, { merge: true });

    console.log(`[AUTH] GitHub integration guardada para usuario ${uid}`);

    return res.redirect(
      `${process.env.REPO_FRONTEND_URL}/github-connected`
    );
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    return res.status(500).json({
      error: 'Error procesando callback GitHub'
    });
  }
});

module.exports = router;
