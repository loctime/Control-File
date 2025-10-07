#!/usr/bin/env node

/**
 * Script para inicializar usuarios en Firestore de ControlFile
 * Crea el documento con cuota de almacenamiento
 * 
 * Uso:
 *   node scripts/init-user.js --uid USER_UID --email user@example.com [--quota 5]
 *   node scripts/init-user.js --batch users.csv
 */

const admin = require('firebase-admin');
require('dotenv').config();

// Parsear credenciales de forma robusta
function parseServiceAccount(envVarName) {
  let raw = process.env[envVarName];
  if (!raw || typeof raw !== 'string') {
    throw new Error(`${envVarName} no está configurada`);
  }
  raw = raw.trim();
  if ((raw.startsWith('\'') && raw.endsWith('\'')) || (raw.startsWith('"') && raw.endsWith('"'))) {
    raw = raw.slice(1, -1);
  }
  try {
    return JSON.parse(raw);
  } catch (_) {}
  try {
    return JSON.parse(raw.replace(/\\n/g, '\n'));
  } catch (_) {}
  try {
    return JSON.parse(raw.replace(/'/g, '"'));
  } catch (e) {
    console.error(`No se pudo parsear ${envVarName}. Valor inicia con:`, raw.slice(0, 60));
    throw e;
  }
}

// Inicializar Firebase Admin (solo app de datos)
if (!admin.apps.length) {
  try {
    const appDataCred = parseServiceAccount('FB_ADMIN_APPDATA');
    admin.initializeApp({
      credential: admin.credential.cert(appDataCred),
      projectId: process.env.FB_DATA_PROJECT_ID,
    });
    console.log('✅ Firebase Admin inicializado');
  } catch (e) {
    console.error('❌ Error inicializando Firebase Admin:', e);
    process.exit(1);
  }
}

const db = admin.firestore();

/**
 * Inicializa un usuario en Firestore
 */
async function initUser(uid, email, quotaGB = 5) {
  try {
    const userRef = db.collection('users').doc(uid);
    
    // Verificar si ya existe
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      console.log('⚠️  Usuario ya existe:', uid);
      console.log('   Email:', userDoc.data().email);
      console.log('   Cuota:', (userDoc.data().planQuotaBytes / 1024 / 1024 / 1024).toFixed(2), 'GB');
      return { exists: true, uid, email: userDoc.data().email };
    }
    
    // Crear usuario
    const quotaBytes = quotaGB * 1024 * 1024 * 1024;
    
    await userRef.set({
      planQuotaBytes: quotaBytes,
      usedBytes: 0,
      pendingBytes: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      email: email
    });
    
    console.log('✅ Usuario inicializado:', uid);
    console.log('   Email:', email);
    console.log('   Cuota:', quotaGB, 'GB');
    
    return { created: true, uid, email, quotaGB };
    
  } catch (error) {
    console.error('❌ Error inicializando usuario:', uid);
    console.error('   Error:', error.message);
    throw error;
  }
}

/**
 * Inicializa múltiples usuarios desde CSV
 */
async function initBatch(csvPath) {
  const fs = require('fs');
  const readline = require('readline');
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Archivo no encontrado: ${csvPath}`);
  }
  
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let lineNum = 0;
  let created = 0;
  let exists = 0;
  let errors = 0;
  
  console.log('📋 Procesando archivo:', csvPath);
  console.log('');
  
  for await (const line of rl) {
    lineNum++;
    
    // Skip header
    if (lineNum === 1 && line.toLowerCase().includes('uid')) {
      continue;
    }
    
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }
    
    // Parse CSV: uid,email,quota
    const parts = line.split(',').map(p => p.trim());
    
    if (parts.length < 2) {
      console.log(`⚠️  Línea ${lineNum}: formato inválido (mínimo uid,email)`);
      errors++;
      continue;
    }
    
    const [uid, email, quotaStr] = parts;
    const quota = quotaStr ? parseFloat(quotaStr) : 5;
    
    try {
      const result = await initUser(uid, email, quota);
      if (result.created) {
        created++;
      } else if (result.exists) {
        exists++;
      }
    } catch (error) {
      errors++;
    }
  }
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Resumen:');
  console.log('   ✅ Creados:', created);
  console.log('   ⚠️  Ya existían:', exists);
  console.log('   ❌ Errores:', errors);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// Parsear argumentos
const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 ? args[index + 1] : null;
};

const uid = getArg('uid');
const email = getArg('email');
const quotaStr = getArg('quota');
const batchFile = getArg('batch');

// Validar y ejecutar
(async () => {
  try {
    if (batchFile) {
      // Modo batch
      await initBatch(batchFile);
    } else if (uid && email) {
      // Modo single
      const quota = quotaStr ? parseFloat(quotaStr) : 5;
      await initUser(uid, email, quota);
    } else {
      // Ayuda
      console.log('');
      console.log('🔧 Script de Inicialización de Usuarios');
      console.log('');
      console.log('Uso:');
      console.log('  node scripts/init-user.js --uid USER_UID --email user@example.com [--quota 5]');
      console.log('  node scripts/init-user.js --batch users.csv');
      console.log('');
      console.log('Formato CSV:');
      console.log('  uid,email,quota');
      console.log('  YS4hCC54WAhj9m0u4fojTaDEpT72,user@example.com,5');
      console.log('  ABC123...,user2@example.com,10');
      console.log('');
      console.log('Ejemplos:');
      console.log('  # Inicializar un usuario con 5GB');
      console.log('  node scripts/init-user.js --uid YS4hCC54WAhj9m0u4fojTaDEpT72 --email d@gmail.com');
      console.log('');
      console.log('  # Inicializar un usuario con 10GB');
      console.log('  node scripts/init-user.js --uid ABC123... --email user@example.com --quota 10');
      console.log('');
      console.log('  # Inicializar múltiples usuarios');
      console.log('  node scripts/init-user.js --batch users.csv');
      console.log('');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
})();

