// scripts/fix-main-folders.js
// Script de limpieza para garantizar una sola carpeta principal por userId + appId

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || path.join(__dirname, '../backend/env.example');
let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY no configurado');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:', error.message);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * Normaliza app.id como slug (lowercase, a-z, 0-9, guiones)
 */
function normalizeAppId(appId) {
  if (!appId || typeof appId !== 'string') {
    return null;
  }
  
  return appId
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Script principal de limpieza
 */
async function fixMainFolders() {
  console.log('🔧 Iniciando limpieza de carpetas principales...\n');

  try {
    // Obtener todos los usuarios únicos
    const usersSnapshot = await db.collection('users').get();
    const userIds = new Set();
    
    usersSnapshot.forEach(doc => {
      userIds.add(doc.id);
    });

    console.log(`📊 Usuarios encontrados: ${userIds.size}\n`);

    let totalFixed = 0;
    let totalSkipped = 0;

    // Procesar cada usuario
    for (const userId of userIds) {
      console.log(`👤 Procesando usuario: ${userId}`);

      // Obtener todas las carpetas del usuario con isMainFolder = true
      const mainFoldersQuery = await db.collection('files')
        .where('userId', '==', userId)
        .where('type', '==', 'folder')
        .where('metadata.isMainFolder', '==', true)
        .get();

      if (mainFoldersQuery.empty) {
        console.log(`   ✅ No hay carpetas principales para este usuario\n`);
        continue;
      }

      console.log(`   📁 Carpetas principales encontradas: ${mainFoldersQuery.size}`);

      // Agrupar por appId
      const foldersByApp = new Map();

      mainFoldersQuery.forEach(doc => {
        const data = doc.data();
        const appId = data.appId ? normalizeAppId(data.appId) : 'legacy';
        
        if (!foldersByApp.has(appId)) {
          foldersByApp.set(appId, []);
        }
        
        foldersByApp.get(appId).push({
          id: doc.id,
          name: data.name,
          createdAt: data.createdAt?.toDate?.() || new Date(0),
          appId: appId,
        });
      });

      // Para cada appId, mantener solo la carpeta más reciente
      for (const [appId, folders] of foldersByApp.entries()) {
        if (folders.length <= 1) {
          console.log(`   ✅ App '${appId}': Solo una carpeta principal (OK)`);
          totalSkipped += folders.length;
          continue;
        }

        console.log(`   ⚠️  App '${appId}': ${folders.length} carpetas principales encontradas`);

        // Ordenar por fecha de creación (más reciente primero)
        folders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Mantener la más reciente, marcar las demás como false
        const keepFolder = folders[0];
        const removeFolders = folders.slice(1);

        console.log(`      ✅ Manteniendo: "${keepFolder.name}" (${keepFolder.id})`);
        
        for (const folder of removeFolders) {
          console.log(`      ❌ Removiendo: "${folder.name}" (${folder.id})`);
          
          await db.collection('files').doc(folder.id).update({
            'metadata.isMainFolder': false,
            updatedAt: new Date(),
          });
          
          totalFixed++;
        }
      }

      console.log('');
    }

    console.log('✅ Limpieza completada\n');
    console.log(`📊 Resumen:`);
    console.log(`   - Carpetas corregidas: ${totalFixed}`);
    console.log(`   - Carpetas sin cambios: ${totalSkipped}`);
    console.log(`   - Total procesado: ${totalFixed + totalSkipped}`);

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  }
}

// Ejecutar script
fixMainFolders()
  .then(() => {
    console.log('\n🎉 Script finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });

