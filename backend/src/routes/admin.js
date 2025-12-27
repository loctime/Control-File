const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

/**
 * POST /api/admin/create-user
 *
 * Endpoint admin-only para creación de usuarios.
 *
 * Requisitos:
 * - Authorization: Bearer <firebase-id-token>
 * - Usuario autenticado debe tener role === "supermax"
 *   en: apps/auditoria/users/{uid}
 */
router.post('/create-user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.slice(7);

    // 🔐 Verificar token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      logger.error('verifyIdToken failed', { error });
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const uidRequester = decodedToken.uid;
    const db = admin.firestore();

    // 🔒 Verificar supermax
    const supermaxRef = db
      .collection('apps')
      .doc('auditoria')
      .collection('users')
      .doc(uidRequester);

    const supermaxSnap = await supermaxRef.get();

    if (!supermaxSnap.exists || supermaxSnap.data()?.role !== 'supermax') {
      return res.status(403).json({
        error: 'No tienes permisos. Se requiere role === supermax',
      });
    }

    // 📦 Validar body
    const { email, password, nombre, role, appId } = req.body || {};

    if (
      !email ||
      !password ||
      !nombre ||
      !role ||
      appId !== 'auditoria'
    ) {
      return res.status(400).json({ error: 'Datos inválidos o incompletos' });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const usersCollection = db
      .collection('apps')
      .doc('auditoria')
      .collection('users');

    // 🔍 Verificar si existe en Auth
    let authUser = null;
    try {
      authUser = await admin.auth().getUserByEmail(email);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') {
        throw e;
      }
    }

    let uid;
    let status;

    // 🔁 Usuario ya existe en Auth
    if (authUser) {
      uid = authUser.uid;

      const existingProfile = await usersCollection.doc(uid).get();
      if (existingProfile.exists) {
        return res.status(409).json({
          error: 'El email ya existe y tiene perfil vinculado',
          uid,
        });
      }

      await usersCollection.doc(uid).set(
        {
          uid,
          email,
          nombre,
          role,
          appId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      status = 'linked';
    } else {
      // 🆕 Crear usuario Auth
      const newUser = await admin.auth().createUser({
        email,
        password,
        displayName: nombre,
        emailVerified: false,
      });

      uid = newUser.uid;

      await usersCollection.doc(uid).set({
        uid,
        email,
        nombre,
        role,
        appId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      status = 'created';
    }

    return res.status(201).json({
      uid,
      status,
      source: 'controlfile',
    });
  } catch (error) {
    logger.error('admin/create-user failed', { error });
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
    });
  }
});

module.exports = router;
