/**
 * Script para migrar users/{uid} a platform/accounts/{uid}
 * 
 * Uso: node scripts/migrate-to-platform.js [--dry-run]
 */

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FB_ADMIN_APPDATA
    ? JSON.parse(process.env.FB_ADMIN_APPDATA)
    : require('../backend/env.example'); // Fallback para desarrollo
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const isDryRun = process.argv.includes('--dry-run');

/**
 * Obtiene el planId por defecto (FREE_5GB)
 */
async function getDefaultPlanId() {
  try {
    // Estructura: platform (documento) -> plans (subcolección) -> {planId} (documento)
    const freePlanDoc = await db.collection('platform').doc('plans').collection('plans').doc('FREE_5GB').get();
    if (freePlanDoc.exists) {
      return 'FREE_5GB';
    }
  } catch (error) {
    console.warn('⚠️  No se pudo verificar plan por defecto, usando FREE_5GB');
  }
  return 'FREE_5GB';
}

/**
 * Migra un usuario a platform/accounts
 */
async function migrateUser(userId, userData) {
  const now = admin.firestore.Timestamp.now();
  const defaultPlanId = await getDefaultPlanId();
  
  // Determinar enabledApps desde custom claims o defaults
  // Por ahora, habilitar todas las apps por defecto
  const enabledApps = {
    controlfile: true,
    controlaudit: true,
    controldoc: true,
  };
  
  const platformAccount = {
    uid: userId,
    status: 'active', // Asumir activos durante migración
    planId: userData.planId || defaultPlanId,
    enabledApps: enabledApps,
    limits: userData.planQuotaBytes ? {
      storageBytes: userData.planQuotaBytes,
    } : undefined,
    paidUntil: null, // Se puede calcular manualmente después si existe información
    trialEndsAt: null,
    createdAt: userData.createdAt || now,
    updatedAt: now,
    metadata: {
      notes: userData.metadata?.notes || '',
      flags: {},
    },
  };
  
  if (isDryRun) {
    console.log(`[DRY RUN] Crearía platform/accounts/${userId}:`, JSON.stringify(platformAccount, null, 2));
    return;
  }
  
  // Estructura: platform (documento) -> accounts (subcolección) -> {uid} (documento)
  await db.collection('platform').doc('accounts').collection('accounts').doc(userId).set(platformAccount);
  console.log(`✅ Migrado: platform/accounts/${userId}`);
}

/**
 * Migra todos los usuarios
 */
async function migrateAllUsers() {
  console.log('🚀 Iniciando migración de usuarios a platform/accounts...\n');
  
  if (isDryRun) {
    console.log('⚠️  MODO DRY RUN - No se realizarán cambios\n');
  }
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;
    
    console.log(`📊 Total de usuarios encontrados: ${totalUsers}\n`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      try {
        // Verificar si ya existe en platform/accounts
        // Estructura: platform (documento) -> accounts (subcolección) -> {uid} (documento)
        const existingAccount = await db.collection('platform').doc('accounts').collection('accounts').doc(userId).get();
        if (existingAccount.exists) {
          console.log(`⏭️  Saltando ${userId} (ya existe en platform/accounts)`);
          skipped++;
          continue;
        }
        
        await migrateUser(userId, userData);
        migrated++;
      } catch (error) {
        console.error(`❌ Error migrando ${userId}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n✨ Migración completada!');
    console.log(`📊 Resumen:`);
    console.log(`   - Migrados: ${migrated}`);
    console.log(`   - Saltados: ${skipped}`);
    console.log(`   - Errores: ${errors}`);
    console.log(`   - Total procesados: ${totalUsers}`);
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
migrateAllUsers()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
