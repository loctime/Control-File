// scripts/check-auth-domains.js
const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'controlstorage-eb796.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('🔍 Verificando configuración de Firebase...');
console.log('📋 Configuración:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKey: firebaseConfig.apiKey ? 'Configurado' : 'No configurado'
});

// Verificar variables de entorno
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

console.log('\n🔍 Verificando variables de entorno...');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`${varName}: ${value ? '✅ Configurado' : '❌ No configurado'}`);
});

console.log('\n📝 Instrucciones para configurar dominios autorizados:');
console.log('1. Ve a https://console.firebase.google.com/project/controlstorage-eb796/authentication/settings');
console.log('2. En la sección "Dominios autorizados", agrega:');
console.log('   - files.controldoc.app');
console.log('   - localhost (para desarrollo)');
console.log('3. Guarda los cambios');

console.log('\n🔗 URLs de redirección esperadas:');
console.log(`- https://${firebaseConfig.authDomain}/__/auth/handler`);
console.log('- https://files.controldoc.app/__/auth/handler');

console.log('\n⚠️ Nota: Si el dominio no está autorizado, verás el error "auth/unauthorized-domain"');
