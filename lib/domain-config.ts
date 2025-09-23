// lib/domain-config.ts - Configuración dinámica de dominios
export interface DomainConfig {
  domain: string;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  b2Config?: {
    keyId: string;
    applicationKey: string;
    bucketId: string;
    bucketName: string;
    endpoint: string;
  };
}

// Configuración de dominios
export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  'files.controldoc.app': {
    domain: 'files.controldoc.app',
    firebaseConfig: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: 'controlstorage-eb796.firebaseapp.com', // Usar el dominio correcto de Firebase
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    },
    b2Config: {
      keyId: process.env.B2_KEY_ID || '',
      applicationKey: process.env.B2_APPLICATION_KEY || '',
      bucketId: process.env.B2_BUCKET_ID || '',
      bucketName: process.env.B2_BUCKET_NAME || '',
      endpoint: process.env.B2_ENDPOINT || '',
    },
  },
  // Configuración para desarrollo local
  'localhost': {
    domain: 'localhost',
    firebaseConfig: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    },
  },
  // Configuración para desarrollo local (IP local)
  'local-dev': {
    domain: 'local-dev',
    firebaseConfig: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    },
  },
};

// Función para obtener la configuración del dominio actual
export function getCurrentDomainConfig(): DomainConfig | null {
  if (typeof window === 'undefined') {
    // Server-side, usar configuración por defecto
    return DOMAIN_CONFIGS['localhost'] || null;
  }

  const currentDomain = window.location.hostname;
  console.log('🌐 Dominio actual:', currentDomain);

  // Buscar configuración exacta
  if (DOMAIN_CONFIGS[currentDomain]) {
    return DOMAIN_CONFIGS[currentDomain];
  }

  // Buscar configuración por subdominio
  const subdomainMatch = Object.keys(DOMAIN_CONFIGS).find(domain => 
    currentDomain.endsWith(domain) && domain !== 'localhost'
  );

  if (subdomainMatch) {
    console.log('🔍 Usando configuración para subdominio:', subdomainMatch);
    return DOMAIN_CONFIGS[subdomainMatch];
  }

  // Fallback a configuración por defecto
  console.log('⚠️ No se encontró configuración específica para:', currentDomain);
  return DOMAIN_CONFIGS['localhost'] || null;
}

// Función para verificar si el dominio está autorizado
export function isDomainAuthorized(): boolean {
  const config = getCurrentDomainConfig();
  return config !== null;
}

// Función para obtener la configuración de Firebase del dominio actual
export function getFirebaseConfig() {
  const config = getCurrentDomainConfig();
  if (!config) {
    throw new Error('No se encontró configuración para el dominio actual');
  }
  return config.firebaseConfig;
}
