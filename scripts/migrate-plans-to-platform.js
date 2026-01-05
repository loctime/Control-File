/**
 * Script para migrar planes desde config/plans.json a platform/plans en Firestore
 * 
 * Uso: node scripts/migrate-plans-to-platform.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Cargar configuración de planes
const plansConfigPath = path.join(__dirname, '../config/plans.json');
const plansConfig = JSON.parse(fs.readFileSync(plansConfigPath, 'utf8'));

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

/**
 * Convierte un plan del formato JSON al formato PlatformPlan
 */
function convertPlanToPlatformPlan(plan, isFree = false) {
  const now = admin.firestore.Timestamp.now();
  
  return {
    planId: plan.planId,
    name: plan.name,
    description: isFree ? 'Plan gratuito' : `Plan de ${plan.name}`,
    isActive: true,
    limits: {
      storageBytes: plan.quotaBytes,
    },
    apps: {
      controlfile: true,
      controlaudit: true,
      controldoc: true,
    },
    pricing: {
      monthly: plan.price,
      yearly: plan.yearlyPrice ?? plan.price * 12,
      currency: plansConfig.currency || 'USD',
    },
    features: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Migra todos los planes a Firestore
 */
async function migratePlans() {
  console.log('🚀 Iniciando migración de planes a platform/plans...\n');
  
  try {
    // Migrar plan gratuito
    // Estructura: platform (documento) -> plans (subcolección) -> {planId} (documento)
    const freePlan = convertPlanToPlatformPlan(plansConfig.free, true);
    console.log(`📦 Migrando plan gratuito: ${freePlan.planId}`);
    await db.collection('platform').doc('plans').collection('plans').doc(freePlan.planId).set(freePlan);
    console.log(`✅ Plan ${freePlan.planId} migrado exitosamente\n`);
    
    // Migrar planes de pago
    for (const plan of plansConfig.plans) {
      const platformPlan = convertPlanToPlatformPlan(plan, false);
      console.log(`📦 Migrando plan: ${platformPlan.planId}`);
      await db.collection('platform').doc('plans').collection('plans').doc(platformPlan.planId).set(platformPlan);
      console.log(`✅ Plan ${platformPlan.planId} migrado exitosamente\n`);
    }
    
    console.log('✨ Migración completada exitosamente!');
    console.log(`📊 Total de planes migrados: ${1 + plansConfig.plans.length}`);
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
migratePlans()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
