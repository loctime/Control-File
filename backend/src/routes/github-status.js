const express = require('express')
const admin = require('firebase-admin')

const router = express.Router()

/**
 * GET /api/github/status
 * Devuelve si el usuario tiene GitHub conectado
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.uid

    const db = admin.firestore()
    const doc = await db
      .collection('githubIntegrations')
      .doc(userId)
      .get()

    return res.json({
      connected: doc.exists
    })
  } catch (err) {
    console.error('GitHub status error:', err)
    return res.status(500).json({
      error: 'Error consultando estado de GitHub'
    })
  }
})

module.exports = router
