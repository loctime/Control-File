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
    console.log('🔧 useAuth useEffect iniciado');
    console.log('🔧 Estado actual:', { 
      hasAuth: !!auth, 
      hasDb: !!db, 
      currentUser: !!user, 
      loading, 
      isOnline: navigator.onLine 
    });

    if (!auth || !db) {
      console.error('❌ Firebase no está configurado:', { auth: !!auth, db: !!db });
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
          console.log('🔁 Resultado de redirección recibido:', {
            uid: redirectResult.user?.uid,
            email: redirectResult.user?.email,
            providerId: redirectResult.providerId
          });
        }
      } catch (redirectError: any) {
        console.error('❌ Error post-redirect de Google:', {
          code: redirectError.code,
          message: redirectError.message,
          stack: redirectError.stack
        });
        // Asegurar que no quede en loading si hubo error en el redirect
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

        // Set up auth state listener directly (no redirect handling needed with popup)
    console.log('🔧 Configurando listener de estado de autenticación...');
    
    if (!auth) {
      console.error('❌ Auth no disponible');
      setLoading(false);
      return;
    }
    
    // Solo configurar el listener si no existe uno previo
    if (!unsubscribe) {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log('🔄 onAuthStateChanged disparado:', {
          hasUser: !!firebaseUser,
          userId: firebaseUser?.uid,
          userEmail: firebaseUser?.email,
          isMounted,
          currentUser: !!user
        });

        if (!isMounted) {
          console.log('⚠️ Componente desmontado, ignorando cambio de estado');
          return;
        }
        
        // Solo establecer loading si no hay usuario o si es un usuario diferente
        if (!user || (firebaseUser && user.uid !== firebaseUser.uid)) {
          console.log('⏳ Estableciendo loading...');
          setLoading(true);
        }
        
        if (firebaseUser) {
          console.log('👤 Usuario de Firebase detectado:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            emailVerified: firebaseUser.emailVerified,
            providerData: firebaseUser.providerData.map(p => ({
              providerId: p.providerId,
              email: p.email
            }))
          });

          // Si ya tenemos el mismo usuario cargado, no hacer nada
          if (user && user.uid === firebaseUser.uid) {
            console.log('ℹ️ Usuario ya cargado, saltando...');
            return;
          }
          
          try {
            // Verificar conectividad antes de intentar acceder a Firestore
            if (!navigator.onLine) {
              console.log('⚠️ Sin conexión, usando datos mínimos del usuario');
              const minimalUserData: User = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                planQuotaBytes: DEFAULT_QUOTA_BYTES,
                usedBytes: 0,
                pendingBytes: 0,
                createdAt: new Date(),
              };
              if (isMounted) {
                console.log('✅ Estableciendo usuario mínimo offline');
                setUser(minimalUserData);
                setLoading(false);
              }
              return;
            }

            console.log('📡 Conectividad OK, obteniendo datos de Firestore...');

            // Get user document from Firestore
            if (!db) {
              console.error('❌ Firestore no está disponible');
              throw new Error('Firestore no está disponible');
            }
            
            console.log('🔍 Firestore disponible, continuando...');
            const userRef = doc(db, 'users', firebaseUser.uid);
            console.log('🔍 Buscando documento de usuario:', firebaseUser.uid);
            
            const userSnap = await getDoc(userRef);
            console.log('📄 Resultado de Firestore:', {
              exists: userSnap.exists(),
              hasData: !!userSnap.data()
            });
            
            let userData: User;
            
            if (userSnap.exists()) {
              // User exists, get data
              const data = userSnap.data();
              console.log('📋 Datos existentes del usuario:', data);
              userData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                planQuotaBytes: data.planQuotaBytes || DEFAULT_QUOTA_BYTES,
                usedBytes: data.usedBytes || 0,
                pendingBytes: data.pendingBytes || 0,
                createdAt: data.createdAt?.toDate() || new Date(),
              };
            } else {
              // New user, create document
              console.log('🆕 Usuario nuevo, creando documento en Firestore...');
              console.log('🔍 Firebase User UID:', firebaseUser.uid);
              console.log('🔍 Firebase User Email:', firebaseUser.email);
              // Generate username from email
              const baseUsername = firebaseUser.email?.split('@')[0] || 'user';
              const cleanUsername = baseUsername.toLowerCase().replace(/[^\w]/g, '');
              let username = cleanUsername;
              
              // Check for username uniqueness
              console.log('🔍 Verificando unicidad del username:', username);
              let counter = 1;
              while (true) {
                try {
                  const existingUserQuery = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
                  if (existingUserQuery.empty) {
                    console.log('✅ Username único:', username);
                    break;
                  }
                  username = `${cleanUsername}${counter}`;
                  counter++;
                  console.log('🔄 Username ocupado, probando:', username);
                } catch (queryError) {
                  console.error('❌ Error verificando username:', queryError);
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
                console.log('📝 Creando documento de usuario con datos:', {
                  uid: firebaseUser.uid,
                  username: userData.username,
                  email: userData.email
                });
                
                await setDoc(userRef, {
                  planQuotaBytes: userData.planQuotaBytes,
                  usedBytes: userData.usedBytes,
                  pendingBytes: userData.pendingBytes,
                  createdAt: userData.createdAt,
                  username: userData.username,
                  metadata: {
                    bio: '',
                    website: '',
                    location: '',
                    isPublic: false,
                    customFields: {}
                  }
                });
                console.log('✅ Documento de usuario creado exitosamente en Firestore');
              } catch (createError: any) {
                console.error('❌ Error creando usuario en Firestore:', {
                  code: createError.code,
                  message: createError.message,
                  uid: firebaseUser.uid,
                  username: userData.username
                });
              }
            }
            
            if (isMounted) {
              console.log('✅ Estableciendo usuario en el store:', {
                uid: userData.uid,
                email: userData.email
              });
              setUser(userData);
              setLoading(false);
            }
          } catch (error: any) {
            console.error('❌ Error obteniendo datos del usuario:', {
              code: error.code,
              message: error.message,
              stack: error.stack
            });
            
            // Create minimal user data if Firestore fails
            console.log('🔄 Creando datos mínimos del usuario debido al error...');
            const minimalUserData: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              planQuotaBytes: DEFAULT_QUOTA_BYTES,
              usedBytes: 0,
              pendingBytes: 0,
              createdAt: new Date(),
            };
            if (isMounted) {
              console.log('✅ Estableciendo usuario mínimo por error');
              setUser(minimalUserData);
              setLoading(false);
            }
          }
        } else {
          console.log('🚪 Usuario no autenticado, limpiando estado...');
          if (isMounted) {
            setUser(null);
            setLoading(false);
          }
        }
      });
    }

    // Cleanup function
    return () => {
      console.log('🧹 Limpiando useAuth useEffect');
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
    console.log('🚀 Iniciando autenticación con Google...');
    console.log('🔍 Configuración actual:', {
      hasAuth: !!auth,
      hasGoogleProvider: !!googleProvider,
      isOnline: navigator.onLine,
      currentUrl: window.location.href,
      userAgent: navigator.userAgent
    });
    
    if (!auth) {
      console.error('❌ Firebase no está configurado');
      throw new Error('Firebase no está configurado');
    }
    
    if (!navigator.onLine) {
      console.error('❌ Sin conexión a internet');
      throw new Error('No hay conexión a internet. Verifica tu conexión e intenta nuevamente.');
    }
    
    try {
      console.log('🔧 Configurando proveedor de Google...');
      // Configure Google provider
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isMobile) {
        console.log('📱 Detectado móvil: usando signInWithRedirect');
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      console.log('🖥️ Desktop: usando signInWithPopup');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('✅ Popup completado exitosamente:', {
        user: result.user.email,
        uid: result.user.uid,
        providerId: result.providerId,
        displayName: result.user.displayName,
        emailVerified: result.user.emailVerified
      });
      
      // El onAuthStateChanged se disparará automáticamente
      console.log('🔄 Esperando que onAuthStateChanged se dispare...');
    } catch (error: any) {
      console.error('❌ Error en signInWithGoogle (popup):', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        name: error.name,
        fullError: error
      });
      
      // Log adicional para errores específicos
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('ℹ️ Usuario cerró el popup manualmente');
      } else if (error.code === 'auth/popup-blocked') {
        console.log('ℹ️ Popup bloqueado por el navegador');
      } else if (error.code === 'auth/unauthorized-domain') {
        console.log('ℹ️ Dominio no autorizado en Firebase Console');
      }
      
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