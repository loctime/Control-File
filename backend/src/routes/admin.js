const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { logger } = require('../utils/logger');

/**
 * POST /api/admin/create-user
 *
 * ⚠️ ENDPOINT DE IDENTIDAD (IAM/Core) - NO LLAMAR DESDE FRONTEND
 *
 * Este endpoint es parte de la infraestructura IAM/Core de ControlFile.
 * Su responsabilidad es SOLO identidad (Auth + Claims), NO lógica de negocio.
 *
 * ⚠️ IMPORTANTE: Este endpoint NO debe ser llamado directamente por frontends.
 * Debe ser llamado únicamente por backends de apps (ControlAudit, ControlDoc, etc.)
 * que orquestan flujos completos de creación de usuarios.
 *
 * RESPONSABILIDAD:
 * - ✅ Crear usuario en Firebase Auth
 * - ✅ Aplicar custom claims (appId, role, ownerId)
 * - ✅ Retornar uid del usuario creado
 *
 * LO QUE NO HACE:
 * - ❌ NO escribe Firestore de ninguna app
 * - ❌ NO valida límites de negocio
 * - ❌ NO aplica reglas de aplicación
 * - ❌ NO crea documentos de usuario en Firestore
 *
 * AUTORIZACIÓN:
 * - Authorization: Bearer <firebase-id-token>
 * - Custom claims del token:
 *   - decodedToken.appId === 'auditoria' (o la app correspondiente)
 *   - decodedToken.role in ['admin', 'supermax']
 *
 * CONTRATO FIJO:
 *
 * Inputs requeridos:
 * {
 *   email: string,        // Email del usuario
 *   password: string,     // Contraseña temporal
 *   nombre: string,       // Nombre a mostrar (se mapea internamente a displayName de Firebase Auth)
 *   role: string,         // Rol del usuario en la app
 *   appId: string         // Identificador de la app (ej: "auditoria")
 * }
 * 
 * Nota sobre naming: El parámetro es "nombre" (decisión de dominio), pero internamente
 * se mapea a "displayName" de Firebase Auth. Si se abre el endpoint a más apps en el futuro,
 * considerar estandarizar a "displayName" para alinearse con Firebase Auth.
 *
 * Output:
 * {
 *   uid: string,          // UID del usuario creado en Firebase Auth
 *   status: "created",    // Estado de la operación
 *   source: "controlfile" // Origen de la creación
 * }
 *
 * QUIÉN DEBE LLAMARLO:
 * - ✅ Backends de apps (ControlAudit, ControlDoc, etc.)
 * - ❌ Frontends directamente
 *
 * FLUJO RECOMENDADO:
 * 1. Frontend llama a su app backend (ej: POST /api/operarios/create)
 * 2. App backend llama a este endpoint para crear identidad
 * 3. App backend escribe Firestore con lógica de negocio
 * 4. App backend aplica validaciones de negocio
 *
 * Referencia: docs/docs_v2/IAM_CORE_CONTRACT.md
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
      // ownerId se toma del token del admin que crea el usuario (decodedToken.uid)
      await admin.auth().setCustomUserClaims(uid, {
        appId: appId,
        role: role,
        ownerId: decodedToken.uid,
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
