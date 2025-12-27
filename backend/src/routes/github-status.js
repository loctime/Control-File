// backend/src/routes/github-status.js
router.get('/status', async (req, res) => {
    try {
      const userId = req.user.uid;
  
      const db = admin.firestore();
      const doc = await db
        .collection('githubIntegrations')
        .doc(userId)
        .get();
  
      return res.json({
        connected: doc.exists
      });
    } catch (err) {
      console.error('GitHub status error:', err);
      return res.status(500).json({
        error: 'Error consultando estado de GitHub'
      });
    }
  });
  