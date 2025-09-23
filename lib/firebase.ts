// lib/firebase.ts - Client-side Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore } from 'firebase/firestore';
import { getCurrentDomainConfig, getFirebaseConfig } from './domain-config';

// Obtener configuración dinámica basada en el dominio
let firebaseConfig;
try {
  // Solo intentar obtener configuración dinámica en el cliente
  if (typeof window !== 'undefined') {
    firebaseConfig = getFirebaseConfig();
  } else {
    // Server-side, usar configuración estática
    firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }
} catch (error) {
  // Fallback a configuración estática si no hay configuración de dominio
  firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

// Initialize Firebase
let app;
let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  // Check if we have the minimum required config
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('🚀 Firebase initialized successfully');
  } else {
    console.error('❌ Missing required Firebase configuration (apiKey or projectId)');
    app = null;
    auth = null;
    db = null;
  }
} catch (error) {
  console.error('❌ Error initializing Firebase:', error);
  app = null;
  auth = null;
  db = null;
}

export { auth, db };