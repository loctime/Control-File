router.get('/auth/github/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/github-error?reason=${error}`
      );
    }

    if (!code || !state) {
      return res.status(400).json({
        error: 'Parámetros OAuth inválidos'
      });
    }

    // Decodificar state (solo validación básica)
    try {
      JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'State inválido' });
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

    // 👉 NO guardar acá todavía
    return res.redirect(
      `${process.env.FRONTEND_URL}/github-connected`
    );
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    return res.status(500).json({
      error: 'Error procesando callback GitHub'
    });
  }
});
