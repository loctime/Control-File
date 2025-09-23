// scripts/check-firebase-config.js
require('dotenv').config({ path: '.env.local' });

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider } = require('firebase/auth');

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
  apiKey: firebaseConfig.apiKey ? '✅ Configurado' : '❌ Faltante',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId ? '✅ Configurado' : '❌ Faltante',
  storageBucket: firebaseConfig.storageBucket ? '✅ Configurado' : '❌ Faltante',
  messagingSenderId: firebaseConfig.messagingSenderId ? '✅ Configurado' : '❌ Faltante',
  appId: firebaseConfig.appId ? '✅ Configurado' : '❌ Faltante',
});

// Verificar que todas las variables estén configuradas
const missingVars = [];
if (!firebaseConfig.apiKey) missingVars.push('NEXT_PUBLIC_FIREBASE_API_KEY');
if (!firebaseConfig.projectId) missingVars.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
if (!firebaseConfig.storageBucket) missingVars.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
if (!firebaseConfig.messagingSenderId) missingVars.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
if (!firebaseConfig.appId) missingVars.push('NEXT_PUBLIC_FIREBASE_APP_ID');

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingVars);
  console.error('📝 Asegúrate de configurar estas variables en tu archivo .env.local o en Vercel');
  process.exit(1);
}

console.log('✅ Todas las variables de entorno están configuradas');

// Inicializar Firebase
try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  console.log('🚀 Firebase inicializado correctamente');
  console.log('🔗 Auth Domain configurado:', firebaseConfig.authDomain);
  console.log('📝 Project ID:', firebaseConfig.projectId);
  
  console.log('\n📋 Pasos para verificar la autenticación:');
  console.log('1. Ve a Firebase Console: https://console.firebase.google.com');
  console.log('2. Selecciona el proyecto: controlstorage-eb796');
  console.log('3. Ve a Authentication > Settings');
  console.log('4. Verifica que "files.controldoc.app" esté en la lista de dominios autorizados');
  console.log('5. Si no está, agrégalo manualmente');
  
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error.message);
  process.exit(1);
}
