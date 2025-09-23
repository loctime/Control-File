const admin = require('firebase-admin');

// Intenta parsear credenciales de forma robusta
function parseServiceAccount(envVarName) {
  let raw = process.env[envVarName];
  if (!raw || typeof raw !== 'string') {
    throw new Error(`${envVarName} no está configurada`);
  }
  raw = raw.trim();
  // Quitar comillas envolventes si existen
  if ((raw.startsWith('\'') && raw.endsWith('\'')) || (raw.startsWith('"') && raw.endsWith('"'))) {
    raw = raw.slice(1, -1);
  }
  // Intento 1: parse directo
  try {
    return JSON.parse(raw);
  } catch (_) {}
  // Intento 2: normalizar \n a saltos reales (algunas UIs escapan distinto)
  try {
    return JSON.parse(raw.replace(/\\n/g, '\n'));
  } catch (_) {}
  // Intento 3: reemplazar comillas simples por dobles (si pegaron JSON con ' ')
  try {
    return JSON.parse(raw.replace(/'/g, '"'));
  } catch (e) {
    console.error(`No se pudo parsear ${envVarName}. Valor inicia con:`, raw.slice(0, 60));
    throw e;
  }
}

let centralAuth; // Auth del proyecto de identidad

// Doble inicialización: App de datos (default) y App de Auth central (nombrada)
if (!admin.apps.length) {
  // App de datos (Firestore de ControlFile)
  try {
    const appDataCred = parseServiceAccount('FB_ADMIN_APPDATA');
    admin.initializeApp({
      credential: admin.credential.cert(appDataCred),
      projectId: process.env.FB_DATA_PROJECT_ID,
    });
  } catch (e) {
    console.error('Error inicializando App de datos:', e);
    throw e;
  }

  // App de Auth central para verifyIdToken
  try {
    const appIdentityCred = parseServiceAccount('FB_ADMIN_IDENTITY');
    const authApp = admin.initializeApp({
      credential: admin.credential.cert(appIdentityCred),
    }, 'authApp');
    centralAuth = authApp.auth();
  } catch (e) {
    console.error('Error inicializando App de identidad:', e);
    throw e;
  }
} else {
  // Reutilizar app nombrada si ya existe
  try {
    centralAuth = admin.app('authApp').auth();
  } catch (_) {
    const appIdentityCred = parseServiceAccount('FB_ADMIN_IDENTITY');
    const authApp = admin.initializeApp({
      credential: admin.credential.cert(appIdentityCred),
    }, 'authApp');
    centralAuth = authApp.auth();
  }
}

const APP_CODE = process.env.APP_CODE || 'controlfile';

module.exports = async (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) {
      return res.status(401).json({
        error: 'Token de autorización requerido',
        code: 'AUTH_TOKEN_MISSING',
      });
    }

    const decoded = await centralAuth.verifyIdToken(token);

    if (!decoded || !decoded.uid) {
      return res.status(401).json({ error: 'Token de usuario inválido', code: 'AUTH_UID_MISSING' });
    }

    // Filtrado opcional por app usando claims
    if (decoded.allowedApps && !decoded.allowedApps.includes(APP_CODE)) {
      return res.status(403).json({ error: 'Acceso no permitido para esta app', code: 'APP_FORBIDDEN' });
    }

    // Compat: mantener req.user y también exponer req.uid/claims
    req.uid = decoded.uid;
    req.claims = decoded;
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      name: decoded.name,
      picture: decoded.picture,
    };

    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expirado', code: 'AUTH_TOKEN_EXPIRED' });
    }
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ error: 'Token revocado', code: 'AUTH_TOKEN_REVOKED' });
    }
    return res.status(401).json({ error: 'No autorizado', code: 'AUTH_FAILED' });
  }
};
