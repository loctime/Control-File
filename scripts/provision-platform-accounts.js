/**
 * Script: provision-platform-accounts.js
 *
 * Provisiona cuentas en platform/accounts/{uid}
 * SOLO para emails explícitos.
 *
 * Reglas:
 * - No crea usuarios Auth
 * - No toca datos de apps
 * - No sobreescribe cuentas existentes
 */

const admin = require('firebase-admin');

// ⚠️ Asegurate de inicializar Admin SDK correctamente
// Ejemplo:
// admin.initializeApp({
//   credential: admin.credential.cert(require('./serviceAccount.json'))
// });

const db = admin.firestore();
const auth = admin.auth();

// 👇 EDITÁ SOLO ESTA LISTA
const EMAILS_TO_PROVISION = [
  'ddd@empresa.com',
  'admin2@empresa.com',
  'admin3@empresa.com',
];

// Valores iniciales (ajustables)
const DEFAULT_ACCOUNT_DATA = {
  status: 'active',
  planId: 'legacy',
  enabledApps: {
    controlfile: true,
    controlaudit: true,
    controldoc: true,
  },
  paidUntil: null,
  trialEndsAt: null,
};

async function provisionAccountByEmail(email) {
  console.log(`\n🔍 Procesando: ${email}`);

  try {
    // 1. Obtener usuario Auth
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;

    const accountRef = db.doc(`platform/accounts/${uid}`);
    const snap = await accountRef.get();

    // 2. Si ya existe → NO TOCAR
    if (snap.exists) {
      console.log(`⚠️  Ya existe platform/accounts/${uid} — se omite`);
      return;
    }

    // 3. Crear cuenta platform
    await accountRef.set({
      uid,
      ...DEFAULT_ACCOUNT_DATA,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        notes: 'Cuenta provisionada manualmente (script inicial)',
      },
    });

    console.log(`✅ Cuenta creada para UID: ${uid}`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ Usuario no existe en Auth: ${email}`);
    } else {
      console.error(`❌ Error con ${email}:`, error.message);
    }
  }
}

async function run() {
  console.log('🚀 Iniciando provisionado de cuentas platform...\n');

  for (const email of EMAILS_TO_PROVISION) {
    await provisionAccountByEmail(email);
  }

  console.log('\n🏁 Script finalizado');
  process.exit(0);
}

run();
