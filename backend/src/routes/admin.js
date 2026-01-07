const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

/**
 * POST /api/admin/create-user
 *
 * PARCHE TRANSITORIO: Endpoint simplificado para creación de usuarios.
 * Compatibilidad con modelo owner-centric.
 * Firestore owner-centric queda EXCLUSIVO de ControlAudit.
 *
 * AUTORIZACIÓN:
 * - Authorization: Bearer <firebase-id-token>
 * - Custom claims del token:
 *   - decodedToken.appId === 'auditoria'
 *   - decodedToken.role in ['admin', 'supermax']
 *
 * FUNCIONALIDAD:
 * - Crea usuario en Firebase Auth
 * - Setea custom claims al nuevo usuario
 * - NO escribe Firestore de ninguna app
 */
router.post('/create-user', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.slice(7);

    // 🔐 Verificar token Firebase
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      logger.error('verifyIdToken failed', { error });
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // 🔒 Autorizar SOLO por custom claims del token
    if (decodedToken.appId !== 'auditoria') {
      return res.status(403).json({
        error: "No tienes permisos. Se requiere appId === 'auditoria' en custom claims.",
      });
    }

    const allowedRoles = ['admin', 'supermax'];
    if (!decodedToken.role || !allowedRoles.includes(decodedToken.role)) {
      return res.status(403).json({
        error: "No tienes permisos. Se requiere role in ['admin', 'supermax'] en custom claims.",
      });
    }

    // 📦 Validar body
    const { email, password, nombre, role, appId } = req.body || {};

    if (!email || !password || !nombre || !role || appId !== 'auditoria') {
      return res.status(400).json({ error: 'Datos inválidos o incompletos' });
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // 🔍 Verificar si existe en Firebase Auth
    let authUser = null;
    try {
      authUser = await admin.auth().getUserByEmail(email);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') {
        throw e;
      }
    }

    // Si el usuario ya existe, retornar error
    if (authUser) {
      return res.status(409).json({
        error: 'El email ya está registrado en Firebase Auth',
        uid: authUser.uid,
      });
    }

    // 🆕 Crear usuario en Firebase Auth
    let uid;
    try {
      const newUser = await admin.auth().createUser({
        email,
        password,
        displayName: nombre,
        emailVerified: false,
      });

      uid = newUser.uid;

      // Setear custom claims al nuevo usuario
      await admin.auth().setCustomUserClaims(uid, {
        appId: appId,
        role: role,
      });
    } catch (error) {
      // Manejar error de email ya existente (race condition)
      if (
        error.code === 'auth/email-already-exists' ||
        error.message?.includes('email-already-exists') ||
        error.message?.includes('already exists')
      ) {
        return res.status(409).json({
          error: 'email-already-exists',
          message: 'El email ya está registrado',
        });
      }

      // Otros errores de Firebase Auth
      if (error.code?.startsWith('auth/')) {
        logger.error('creating user (firebase auth error)', { error });
        return res.status(400).json({
          error: error.code,
          message: error.message || 'Error al crear usuario',
        });
      }

      // Error desconocido
      throw error;
    }

    // NOTA: NO escribimos Firestore - Firestore owner-centric queda exclusivo de ControlAudit
    return res.status(201).json({
      uid,
      status: 'created',
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
