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

// Intenta parsear JSON de cuenta de servicio sin lanzar (para fallbacks)
function tryParseServiceAccountJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed);
    if (data && (data.project_id || data.projectId) && (data.client_email || data.private_key)) return data;
    return null;
  } catch (_) {}
  try {
    const data = JSON.parse(trimmed.replace(/\\n/g, '\n'));
    if (data && (data.project_id || data.projectId) && (data.client_email || data.private_key)) return data;
    return null;
  } catch (_) {}
  return null;
}

// Doble inicialización: App de datos (default) y App de Auth central (nombrada)
if (!admin.apps.length) {
  // App de datos (Firestore de ControlFile)
  try {
    let appDataCred = null;
    const rawAppData = process.env.FB_ADMIN_APPDATA;
    if (rawAppData && typeof rawAppData === 'string') {
      try {
        appDataCred = parseServiceAccount('FB_ADMIN_APPDATA');
      } catch (_) {}
    }
    let credSource = 'FB_ADMIN_APPDATA';
    if (!appDataCred && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      appDataCred = tryParseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      if (appDataCred) credSource = 'GOOGLE_SERVICE_ACCOUNT_KEY';
    }
    if (appDataCred) {
      const projectId = process.env.FB_DATA_PROJECT_ID || appDataCred.project_id || appDataCred.projectId;
      admin.initializeApp({
        credential: admin.credential.cert(appDataCred),
        projectId,
      });
      console.log(`[Firebase] Inicializado con ${credSource}, projectId: ${projectId}`);
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
      let clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!clientEmail && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        const fromGoogle = tryParseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        if (fromGoogle) clientEmail = fromGoogle.client_email;
      }
      if (projectId && privateKeyRaw && clientEmail) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
          }),
          projectId,
        });
        console.log(`[Firebase] Inicializado con FIREBASE_* (split), projectId: ${projectId}`);
      } else {
        throw new Error('Configura FB_ADMIN_APPDATA, GOOGLE_SERVICE_ACCOUNT_KEY (JSON completo), o (FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL o FIREBASE_SERVICE_ACCOUNT_KEY + FIREBASE_PRIVATE_KEY o FIREBASE_ADMIN_PRIVATE_KEY)');
      }
    }
  } catch (e) {
    console.error('Error inicializando App de datos:', e);
    throw e;
  }

  // App de Auth central para verifyIdToken (mismo proyecto que datos o identidad separada)
  try {
    if (process.env.FB_ADMIN_IDENTITY) {
      const appIdentityCred = parseServiceAccount('FB_ADMIN_IDENTITY');
      const authApp = admin.initializeApp({
        credential: admin.credential.cert(appIdentityCred),
      }, 'authApp');
      centralAuth = authApp.auth();
    } else {
      centralAuth = admin.auth();
    }
  } catch (e) {
    console.error('Error inicializando App de identidad:', e);
    throw e;
  }
} else {
  // Reutilizar app nombrada si ya existe
  try {
    centralAuth = admin.app('authApp').auth();
  } catch (_) {
    centralAuth = admin.auth();
  }
}

// APP_CODE eliminado - ya no es necesario

// Auto-inicializar usuario en Firestore si no existe
async function ensureUserExists(uid, email) {
  try {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.log('🔧 Auto-inicializando usuario en Firestore:', uid);
      
      const defaultQuotaGB = parseInt(process.env.DEFAULT_USER_QUOTA_GB) || 5;
      const quotaBytes = defaultQuotaGB * 1024 * 1024 * 1024;
      
      await userRef.set({
        planQuotaBytes: quotaBytes,
        usedBytes: 0,
        pendingBytes: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        email: email || ''
      });
      
      console.log(`✅ Usuario auto-inicializado con ${defaultQuotaGB}GB de cuota`);
    }
  } catch (error) {
    // No bloqueamos la request si falla, solo loggeamos
    console.error('⚠️  Error auto-inicializando usuario (no crítico):', error.message);
  }
}

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

    // Verificar que el usuario tenga acceso (claims ya validados por Firebase)
    // No necesitamos filtrar por APP_CODE, la seguridad viene de los claims

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

    // Auto-inicializar usuario en Firestore si no existe (async, no blocking)
    ensureUserExists(decoded.uid, decoded.email).catch(err => {
      console.error('Error en ensureUserExists:', err);
    });

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
