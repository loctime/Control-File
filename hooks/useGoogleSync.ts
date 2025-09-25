// hooks/useGoogleSync.ts
import { useAuth } from './useAuth';
import { useAuthStore } from '@/lib/stores/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export function useGoogleSync() {
  const { user } = useAuth();
  const { setUser } = useAuthStore();

  const forceGoogleSync = async () => {
    if (!user || !auth || !auth.currentUser || !db) {
      console.error('❌ No hay usuario autenticado o Firestore no disponible');
      return false;
    }

    try {
      console.log('🔄 Forzando sincronización con Google...');
      
      const firebaseUser = auth.currentUser;
      const userRef = doc(db, 'users', user.uid);
      
      // Actualizar información de Google
      const updateData = {
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        email: firebaseUser.email,
        lastGoogleSync: new Date()
      };
      
      await setDoc(userRef, updateData, { merge: true });
      
      // Actualizar el store local
      const updatedUser = {
        ...user,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        email: firebaseUser.email || user.email
      };
      
      setUser(updatedUser);
      
      console.log('✅ Sincronización forzada completada');
      return true;
    } catch (error) {
      console.error('❌ Error en sincronización forzada:', error);
      return false;
    }
  };

  const checkGoogleChanges = () => {
    if (!user || !auth || !auth.currentUser) {
      return false;
    }

    const firebaseUser = auth.currentUser;
    return (
      user.displayName !== firebaseUser.displayName ||
      user.photoURL !== firebaseUser.photoURL ||
      user.email !== firebaseUser.email
    );
  };

  return {
    forceGoogleSync,
    checkGoogleChanges,
    hasGoogleChanges: checkGoogleChanges()
  };
}
