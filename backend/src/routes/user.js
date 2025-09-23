const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Get taskbar items for the authenticated user
router.get('/taskbar', async (req, res) => {
  try {
    const { uid } = req.user;
    const docRef = admin.firestore().collection('userSettings').doc(uid);
    const snap = await docRef.get();
    const data = snap.exists ? snap.data() : {};
    res.json({ items: data.taskbarItems || [] });
  } catch (error) {
    console.error('Error getting taskbar items:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Save taskbar items for the authenticated user
router.post('/taskbar', async (req, res) => {
  try {
    const { uid } = req.user;
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Formato inválido' });
    }
    const docRef = admin.firestore().collection('userSettings').doc(uid);
    await docRef.set({ taskbarItems: items, updatedAt: new Date() }, { merge: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving taskbar items:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;


