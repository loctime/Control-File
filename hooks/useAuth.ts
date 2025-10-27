// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/lib/stores/auth';
import { User } from '@/types';
import { getFirebaseConfig } from '@/lib/domain-config';
import { getDefaultFreeQuotaBytes } from '@/lib/plans';

const googleProvider = new GoogleAuthProvider();
const DEFAULT_QUOTA_BYTES = getDefaultFreeQuotaBytes();

// Función para sincronizar información del usuario con Google
async function syncUserWithGoogle(firebaseUser: any, currentUser: User, setUser: (user: User) => void) {
  if (!db) {
    console.error('❌ Firestore no disponible para sincronización');
    return;
  }

  try {
    console.log('🔄 Sincronizando información de Google...');
    
    const userRef = doc(db, 'users', firebaseUser.uid);
    
    // Actualizar solo los campos que pueden cambiar en Google
    const updateData = {
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      email: firebaseUser.email,
      lastGoogleSync: new Date() // Timestamp de la última sincronización
    };
    
    await setDoc(userRef, updateData, { merge: true });
    
    // Actualizar el store local
    const updatedUser = {
      ...currentUser,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      email: firebaseUser.email
    };
    
    setUser(updatedUser);
    
    console.log('✅ Información de Google sincronizada exitosamente');
  } catch (error) {
    console.error('❌ Error sincronizando con Google:', error);
  }
}

export function useAuth() {
  const { user, loading, setUser, setLoading, updateQuota } = useAuthStore();
  const [isOnline, setIsOnline] = useState(true);

  // Detectar estado de conectividad
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!auth || !db) {
      console.error('Firebase no está configurado');
      setLoading(false);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    // Manejar resultado de redirección (flujo móvil)
    (async () => {
      if (!auth) return;
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult) {
          // Usuario autenticado via redirect
        }
      } catch (redirectError: any) {
        console.error('Error en autenticación Google:', redirectError.message);
        // Asegurar que no quede en loading si hubo error en el redirect
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

        // Set up auth state listener directly (no redirect handling needed with popup)
    
    // Solo configurar el listener si no existe uno previo
    if (!unsubscribe) {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!isMounted) {
          return;
        }
        
        // Solo establecer loading si no hay usuario o si es un usuario diferente
        if (!user || (firebaseUser && user.uid !== firebaseUser.uid)) {
          setLoading(true);
        }
        
        if (firebaseUser) {
          // Si ya tenemos el mismo usuario cargado, verificar si hay cambios en Google
          if (user && user.uid === firebaseUser.uid) {
            // Verificar si hay cambios en la información de Google
            const hasChanges = (
              user.displayName !== firebaseUser.displayName ||
              user.photoURL !== firebaseUser.photoURL ||
              user.email !== firebaseUser.email
            );
            
            if (hasChanges) {
              await syncUserWithGoogle(firebaseUser, user, setUser);
            }
            return;
          }
          
          try {
            // Verificar conectividad antes de intentar acceder a Firestore
            if (!navigator.onLine) {
              const minimalUserData: User = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                username: firebaseUser.email?.split('@')[0] || 'user',
                planQuotaBytes: DEFAULT_QUOTA_BYTES,
                usedBytes: 0,
                pendingBytes: 0,
                createdAt: new Date(),
              };
              if (isMounted) {
                setUser(minimalUserData);
                setLoading(false);
              }
              return;
            }

            // Get user document from Firestore
            if (!db) {
              throw new Error('Firestore no está disponible');
            }
            
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);
            
            let userData: User;
            
            if (userSnap.exists()) {
              // User exists, get data
              const data = userSnap.data();
              
              // Si el usuario no tiene username, generarlo y actualizarlo
              let username = data.username;
              if (!username) {
                const baseUsername = firebaseUser.email?.split('@')[0] || 'user';
                const cleanUsername = baseUsername.toLowerCase().replace(/[^\w]/g, '');
                username = cleanUsername;
                
                // Verificar unicidad del username (simplificado para evitar errores de permisos)
                let counter = 1;
                let finalUsername = username;
                while (counter < 100) { // Límite de intentos para evitar bucle infinito
                  try {
                    // Intentar crear el documento con el username actual
                    const testDocRef = doc(db, 'users', `username-check-${finalUsername}`);
                    const testDoc = await getDoc(testDocRef);
                    
                    if (!testDoc.exists()) {
                      // Username disponible, usar este
                      username = finalUsername;
                      break;
                    } else {
                      // Username ocupado, probar siguiente
                      finalUsername = `${cleanUsername}${counter}`;
                      counter++;
                    }
                  } catch (queryError) {
                    console.error('Error verificando username:', queryError);
                    // En caso de error, usar el username base con timestamp
                    username = `${cleanUsername}${Date.now()}`;
                    break;
                  }
                }
                
                // Actualizar el usuario con el username generado
                try {
                  await setDoc(userRef, { username }, { merge: true });
                } catch (updateError) {
                  console.error('Error actualizando username:', updateError);
                }
              }
              
              userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                planQuotaBytes: data.planQuotaBytes || DEFAULT_QUOTA_BYTES,
                usedBytes: data.usedBytes || 0,
                pendingBytes: data.pendingBytes || 0,
                createdAt: data.createdAt?.toDate() || new Date(),
                username: username,
              };
            } else {
              // New user, create document
              // Generate username from email
              const baseUsername = firebaseUser.email?.split('@')[0] || 'user';
              const cleanUsername = baseUsername.toLowerCase().replace(/[^\w]/g, '');
              let username = cleanUsername;
              
              // Check for username uniqueness
              let counter = 1;
              while (true) {
                try {
                  const existingUserQuery = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
                  if (existingUserQuery.empty) {
                    break;
                  }
                  username = `${cleanUsername}${counter}`;
                  counter++;
                } catch (queryError) {
                  console.error('Error verificando username:', queryError);
                  // Si hay error en la consulta, usar el username base
                  break;
                }
              }

              userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                planQuotaBytes: DEFAULT_QUOTA_BYTES,
                usedBytes: 0,
                pendingBytes: 0,
                createdAt: new Date(),
                username: username,
              };
              
              try {
                await setDoc(userRef, {
                  planQuotaBytes: userData.planQuotaBytes,
                  usedBytes: userData.usedBytes,
                  pendingBytes: userData.pendingBytes,
                  createdAt: userData.createdAt,
                  username: userData.username,
                  email: userData.email,
                  displayName: userData.displayName,
                  photoURL: userData.photoURL,
                  lastGoogleSync: new Date(), // Timestamp de la última sincronización
                  metadata: {
                    bio: '',
                    website: '',
                    location: '',
                    isPublic: true, // Perfil público por defecto
                    customFields: {}
                  }
                });
              } catch (createError: any) {
                console.error('Error creando usuario en Firestore:', createError.message);
              }
            }
            
            if (isMounted) {
              setUser(userData);
              setLoading(false);
            }
          } catch (error: any) {
            console.error('Error obteniendo datos del usuario:', error.message);
            
            // Create minimal user data if Firestore fails
            const minimalUserData: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              username: firebaseUser.email?.split('@')[0] || 'user',
              planQuotaBytes: DEFAULT_QUOTA_BYTES,
              usedBytes: 0,
              pendingBytes: 0,
              createdAt: new Date(),
            };
            if (isMounted) {
              setUser(minimalUserData);
              setLoading(false);
            }
          }
        } else {
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
        }
      });
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase no está configurado');
    }
    
    if (!navigator.onLine) {
      throw new Error('No hay conexión a internet. Verifica tu conexión e intenta nuevamente.');
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase no está configurado');
    }
    
    if (!navigator.onLine) {
      throw new Error('No hay conexión a internet. Verifica tu conexión e intenta nuevamente.');
    }
    
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const signInWithGoogle = async () => {
    if (!auth) {
      throw new Error('Firebase no está configurado');
    }
    
    if (!navigator.onLine) {
      throw new Error('No hay conexión a internet. Verifica tu conexión e intenta nuevamente.');
    }
    
    try {
      // Configure Google provider
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      const result = await signInWithPopup(auth, googleProvider);
      // El onAuthStateChanged se disparará automáticamente
    } catch (error: any) {
      throw new Error(getAuthErrorMessage(error.code));
    }
  };

  const logOut = async () => {
    if (!auth) {
      throw new Error('Firebase no está configurado');
    }
    
    try {
      await signOut(auth);
    } catch (error: any) {
      throw new Error('Error al cerrar sesión');
    }
  };

  const refreshUserQuota = async () => {
    if (!user || !db) return;
    if (!navigator.onLine) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        updateQuota(data.usedBytes || 0, data.pendingBytes || 0);
        // También refrescar planQuotaBytes en el store de usuario
        setUser({
          ...(user as any),
          planQuotaBytes: data.planQuotaBytes ?? (user as any).planQuotaBytes,
        } as User);
      }
    } catch (error: any) {
      console.error('Error refreshing quota:', error);
    }
  };

  return {
    user,
    loading,
    isOnline,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    logOut,
    refreshUserQuota,
  };
}

function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
      return 'No existe una cuenta con este email';
    case 'auth/wrong-password':
      return 'Contraseña incorrecta';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este email';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres';
    case 'auth/invalid-email':
      return 'Email inválido';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Intenta más tarde';
    case 'auth/popup-closed-by-user':
      return 'Ventana cerrada por el usuario';
    case 'auth/cancelled-popup-request':
      return 'Operación cancelada';
    case 'auth/popup-blocked':
      return 'El popup fue bloqueado por el navegador. Permite popups para este sitio';
    case 'auth/unauthorized-domain':
      return 'Dominio no autorizado. Agrega "files.controldoc.app" a los dominios autorizados en Firebase Console';
    case 'auth/network-request-failed':
      return 'Error de conexión. Verifica tu conexión a internet';
    case 'auth/operation-not-allowed':
      return 'Operación no permitida. Contacta al administrador';
    case 'auth/requires-recent-login':
      return 'Se requiere un inicio de sesión reciente para esta operación';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con este email usando otro método de autenticación';
    case 'auth/invalid-credential':
      return 'Credenciales inválidas';
    case 'auth/user-disabled':
      return 'La cuenta ha sido deshabilitada';
    case 'auth/user-token-expired':
      return 'La sesión ha expirado. Inicia sesión nuevamente';
    case 'auth/redirect-cancelled-by-user':
      return 'Autenticación cancelada por el usuario';
    case 'auth/redirect-operation-pending':
      return 'Operación de redirección en progreso';
    default:
      return `Error de autenticación: ${code}`;
  }
}