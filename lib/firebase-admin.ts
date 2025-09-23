// lib/firebase-admin.ts - Server-side Firebase Admin
import { initializeApp as initializeAdminApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

let adminDb: any = null;
let adminAuth: any = null;

// Solo inicializar Firebase Admin si estamos en el servidor y las variables están disponibles
function initializeFirebaseAdmin() {
  if (typeof window === 'undefined' && !getApps().length) {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

      // Solo inicializar si todas las variables están disponibles
      if (projectId && clientEmail && privateKey) {
        initializeAdminApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        
        adminDb = getAdminFirestore();
        adminAuth = getAdminAuth();
      }
    } catch (error) {
      // Silenciar errores durante el build
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Firebase Admin initialization skipped:', error);
      }
    }
  }
}

// Helper functions para verificar disponibilidad
export function requireAdminAuth() {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin Auth no está disponible en el cliente');
  }
  
  if (!adminAuth) {
    initializeFirebaseAdmin();
    if (!adminAuth) {
      throw new Error('Firebase Admin Auth no está disponible');
    }
  }
  return adminAuth;
}

export function requireAdminDb() {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin Firestore no está disponible en el cliente');
  }
  
  if (!adminDb) {
    initializeFirebaseAdmin();
    if (!adminDb) {
      throw new Error('Firebase Admin Firestore no está disponible');
    }
  }
  return adminDb;
}

// Exportar las funciones con manejo de errores
export { adminDb, adminAuth };
