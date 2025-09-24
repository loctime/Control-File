// scripts/migrate-to-slugs.js
// Script para migrar datos existentes a la nueva estructura con slugs

const admin = require('firebase-admin');
require('dotenv').config();

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

/**
 * Genera un slug único a partir de un nombre
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remover caracteres especiales
    .replace(/[\s_-]+/g, '-') // Reemplazar espacios y guiones con un solo guión
    .replace(/^-+|-+$/g, ''); // Remover guiones al inicio y final
}

/**
 * Genera un username único a partir del email
 */
function generateUsernameFromEmail(email) {
  const baseUsername = email.split('@')[0];
  return generateSlug(baseUsername);
}

/**
 * Migra usuarios existentes para agregar username
 */
async function migrateUsers() {
  console.log('🔄 Migrando usuarios...');
  
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.get();
  
  let migratedCount = 0;
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    
    // Si ya tiene username, saltar
    if (userData.username) {
      continue;
    }
    
    // Generar username único
    const baseUsername = generateUsernameFromEmail(userData.email || 'user');
    let username = baseUsername;
    
    // Verificar unicidad
    let counter = 1;
    while (true) {
      const existingUser = await usersRef.where('username', '==', username).limit(1).get();
      if (existingUser.empty) break;
      username = `${baseUsername}${counter}`;
      counter++;
    }
    
    // Actualizar usuario
    await userDoc.ref.update({
      username: username,
      metadata: {
        bio: '',
        website: '',
        location: '',
        isPublic: false,
        customFields: {}
      }
    });
    
    migratedCount++;
    console.log(`✅ Usuario migrado: ${userData.email} -> ${username}`);
  }
  
  console.log(`🎉 Migración de usuarios completada: ${migratedCount} usuarios migrados`);
}

/**
 * Migra carpetas existentes para agregar slug
 */
async function migrateFolders() {
  console.log('🔄 Migrando carpetas...');
  
  const foldersRef = db.collection('folders');
  const foldersSnapshot = await foldersRef.get();
  
  let migratedCount = 0;
  
  for (const folderDoc of foldersSnapshot.docs) {
    const folderData = folderDoc.data();
    
    // Si ya tiene slug, saltar
    if (folderData.slug) {
      continue;
    }
    
    // Generar slug
    const slug = generateSlug(folderData.name);
    
    // Actualizar carpeta
    await folderDoc.ref.update({
      slug: slug,
      metadata: {
        ...folderData.metadata,
        description: folderData.metadata?.description || '',
        tags: folderData.metadata?.tags || [],
        isPublic: folderData.metadata?.isPublic || false,
        viewCount: folderData.metadata?.viewCount || 0,
        lastAccessedAt: folderData.metadata?.lastAccessedAt || new Date(),
        permissions: folderData.metadata?.permissions || {
          canEdit: true,
          canDelete: true,
          canShare: true,
          canDownload: true
        },
        customFields: folderData.metadata?.customFields || {}
      }
    });
    
    migratedCount++;
    console.log(`✅ Carpeta migrada: ${folderData.name} -> ${slug}`);
  }
  
  console.log(`🎉 Migración de carpetas completada: ${migratedCount} carpetas migradas`);
}

/**
 * Migra archivos existentes para agregar slug
 */
async function migrateFiles() {
  console.log('🔄 Migrando archivos...');
  
  const filesRef = db.collection('files');
  const filesSnapshot = await filesRef.get();
  
  let migratedCount = 0;
  
  for (const fileDoc of filesSnapshot.docs) {
    const fileData = fileDoc.data();
    
    // Si ya tiene slug, saltar
    if (fileData.slug) {
      continue;
    }
    
    // Generar slug del nombre del archivo (sin extensión)
    const fileName = fileData.name || 'archivo';
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    const slug = generateSlug(nameWithoutExt);
    
    // Actualizar archivo
    await fileDoc.ref.update({
      slug: slug,
      metadata: {
        ...fileData.metadata,
        isPublic: fileData.metadata?.isPublic || false,
        downloadCount: fileData.metadata?.downloadCount || 0,
        lastAccessedAt: fileData.metadata?.lastAccessedAt || new Date(),
        permissions: fileData.metadata?.permissions || {
          canEdit: true,
          canDelete: true,
          canShare: true,
          canDownload: true
        },
        customFields: fileData.metadata?.customFields || {}
      }
    });
    
    migratedCount++;
    console.log(`✅ Archivo migrado: ${fileData.name} -> ${slug}`);
  }
  
  console.log(`🎉 Migración de archivos completada: ${migratedCount} archivos migrados`);
}

/**
 * Función principal de migración
 */
async function migrateAll() {
  try {
    console.log('🚀 Iniciando migración a slugs...');
    
    await migrateUsers();
    await migrateFolders();
    await migrateFiles();
    
    console.log('🎉 ¡Migración completada exitosamente!');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  migrateAll();
}

module.exports = { migrateAll, migrateUsers, migrateFolders, migrateFiles };
