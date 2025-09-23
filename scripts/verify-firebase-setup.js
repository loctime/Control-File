// scripts/verify-firebase-setup.js
const { initializeApp } = require('firebase/app');
const { getAuth, GoogleAuthProvider } = require('firebase/auth');

console.log('🔍 Verificando configuración completa de Firebase...\n');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'controlstorage-eb796.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('📋 Configuración de Firebase:');
console.log('✅ API Key:', firebaseConfig.apiKey ? 'Configurado' : '❌ Faltante');
console.log('✅ Auth Domain:', firebaseConfig.authDomain);
console.log('✅ Project ID:', firebaseConfig.projectId ? 'Configurado' : '❌ Faltante');
console.log('✅ Storage Bucket:', firebaseConfig.storageBucket ? 'Configurado' : '❌ Faltante');
console.log('✅ Messaging Sender ID:', firebaseConfig.messagingSenderId ? 'Configurado' : '❌ Faltante');
console.log('✅ App ID:', firebaseConfig.appId ? 'Configurado' : '❌ Faltante');

// Verificar variables faltantes
const missingVars = [];
if (!firebaseConfig.apiKey) missingVars.push('NEXT_PUBLIC_FIREBASE_API_KEY');
if (!firebaseConfig.projectId) missingVars.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
if (!firebaseConfig.storageBucket) missingVars.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
if (!firebaseConfig.messagingSenderId) missingVars.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
if (!firebaseConfig.appId) missingVars.push('NEXT_PUBLIC_FIREBASE_APP_ID');

if (missingVars.length > 0) {
  console.error('\n❌ Variables de entorno faltantes:', missingVars);
  process.exit(1);
}

console.log('\n✅ Todas las variables de entorno están configuradas');

// Inicializar Firebase
try {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const googleProvider = new GoogleAuthProvider();
  
  console.log('\n🚀 Firebase inicializado correctamente');
  console.log('🔗 Auth Domain configurado:', firebaseConfig.authDomain);
  console.log('📝 Project ID:', firebaseConfig.projectId);
  
  console.log('\n📋 Pasos para verificar la autenticación:');
  console.log('1. Ve a Firebase Console: https://console.firebase.google.com');
  console.log('2. Selecciona el proyecto: controlstorage-eb796');
  console.log('3. Ve a Authentication > Settings');
  console.log('4. Verifica que "files.controldoc.app" esté en la lista de dominios autorizados');
  console.log('5. Si no está, agrégalo manualmente');
  console.log('\n6. Ve a Authentication > Sign-in method');
  console.log('7. Verifica que Google esté habilitado');
  console.log('8. Si no está, habilítalo y configura el nombre del proyecto');
  
  console.log('\n🔗 Enlaces directos:');
  console.log('• Firebase Auth Settings: https://console.firebase.google.com/project/controlstorage-eb796/authentication/settings');
  console.log('• Firebase Sign-in Methods: https://console.firebase.google.com/project/controlstorage-eb796/authentication/providers');
  console.log('• Google Cloud OAuth: https://console.cloud.google.com/apis/credentials?project=controlstorage-eb796');
  
  console.log('\n🌐 Dominios que deben estar autorizados:');
  console.log('• files.controldoc.app');
  console.log('• controlstorage-eb796.firebaseapp.com');
  console.log('• localhost (para desarrollo)');
  
} catch (error) {
  console.error('\n❌ Error al inicializar Firebase:', error.message);
  process.exit(1);
}
