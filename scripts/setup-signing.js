#!/usr/bin/env node

/**
 * Script para configurar la firma digital de Android
 * Uso: node scripts/setup-signing.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ANDROID_DIR = path.join(__dirname, '..', 'android');
const APP_DIR = path.join(ANDROID_DIR, 'app');
const KEYSTORE_FILE = path.join(APP_DIR, 'keystore.jks');
const KEYSTORE_PROPERTIES = path.join(APP_DIR, 'keystore.properties');
const BUILD_GRADLE = path.join(APP_DIR, 'build.gradle');

console.log('🔐 Configurando firma digital para ControlFile...');

// Verificar si ya existe keystore
if (fs.existsSync(KEYSTORE_FILE)) {
  console.log('✅ Keystore ya existe:', KEYSTORE_FILE);
} else {
  console.log('📝 Generando nuevo keystore...');
  
  // Comando para generar keystore
  const keytoolCommand = `keytool -genkey -v -keystore "${KEYSTORE_FILE}" -keyalg RSA -keysize 2048 -validity 10000 -alias controlfile-key -storepass YOUR_STORE_PASSWORD -keypass YOUR_KEY_PASSWORD -dname "CN=ControlFile, OU=Development, O=ControlDoc, L=City, S=State, C=US"`;
  
  try {
    execSync(keytoolCommand, { stdio: 'inherit' });
    console.log('✅ Keystore generado exitosamente');
  } catch (error) {
    console.error('❌ Error generando keystore:', error.message);
    console.log('\n💡 Genera el keystore manualmente:');
    console.log(keytoolCommand);
    process.exit(1);
  }
}

// Crear archivo keystore.properties
const keystorePropertiesContent = `storeFile=keystore.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=controlfile-key
keyPassword=YOUR_KEY_PASSWORD
`;

fs.writeFileSync(KEYSTORE_PROPERTIES, keystorePropertiesContent);
console.log('✅ keystore.properties creado');

// Verificar si build.gradle ya tiene configuración de firma
const buildGradleContent = fs.readFileSync(BUILD_GRADLE, 'utf8');

if (buildGradleContent.includes('signingConfigs')) {
  console.log('✅ build.gradle ya tiene configuración de firma');
} else {
  console.log('📝 Agregando configuración de firma a build.gradle...');
  
  const signingConfig = `
android {
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            } else {
                // Usar archivo keystore.properties para desarrollo
                def keystorePropertiesFile = rootProject.file('app/keystore.properties')
                def keystoreProperties = new Properties()
                if (keystorePropertiesFile.exists()) {
                    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                    storeFile file(keystoreProperties['storeFile'])
                    storePassword keystoreProperties['storePassword']
                    keyAlias keystoreProperties['keyAlias']
                    keyPassword keystoreProperties['keyPassword']
                }
            }
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
`;

  // Insertar configuración después de la línea "android {"
  const updatedContent = buildGradleContent.replace(
    /(android\s*\{)/,
    `$1${signingConfig}`
  );
  
  fs.writeFileSync(BUILD_GRADLE, updatedContent);
  console.log('✅ build.gradle actualizado con configuración de firma');
}

console.log('\n🎉 Configuración de firma completada!');
console.log('\n📋 Próximos pasos:');
console.log('1. Para desarrollo: npm run android:build:prod');
console.log('2. Para producción: Configurar variables de entorno MYAPP_RELEASE_*');
console.log('3. Para CI/CD: Usar secrets de GitHub Actions');
console.log('\n⚠️  IMPORTANTE: Cambiar las contraseñas por defecto en producción!');
