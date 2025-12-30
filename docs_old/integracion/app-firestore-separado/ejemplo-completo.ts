/**
 * Ejemplo Completo: Sincronización de Archivos entre ControlFile y Firestore Propio
 * 
 * Este ejemplo muestra cómo:
 * 1. Subir archivos a ControlFile usando el backend
 * 2. Sincronizar metadatos a tu propio Firestore
 * 3. Mantener ambos sistemas actualizados
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

// ============================================
// CONFIGURACIÓN
// ============================================

// Configuración de Firebase Auth (compartido con ControlFile)
const CONTROLFILE_AUTH_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!, // Proyecto de Auth
};

// Configuración de tu propio Firestore
const MY_FIRESTORE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_MY_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_MY_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_MY_FIREBASE_PROJECT_ID!, // Tu proyecto
};

// URL del backend de ControlFile
const BACKEND_URL = process.env.NEXT_PUBLIC_CONTROLFILE_BACKEND_URL || 'https://controlfile.onrender.com';

// ============================================
// INICIALIZACIÓN
// ============================================

// Inicializar Firebase Auth (compartido)
const authApp = initializeApp(CONTROLFILE_AUTH_CONFIG, 'controlfile-auth');
const auth = getAuth(authApp);

// Inicializar tu propio Firestore
const myApp = initializeApp(MY_FIRESTORE_CONFIG, 'my-firestore');
const myDb = getFirestore(myApp);

// ============================================
// TIPOS
// ============================================

interface ControlFileMetadata {
  id: string;
  userId: string;
  name: string;
  size: number;
  mime: string;
  bucketKey: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MyFileMetadata extends ControlFileMetadata {
  controlFileId: string; // Referencia al ID en ControlFile
  syncedAt: Date;
  source: 'controlfile';
  customFields?: {
    category?: string;
    tags?: string[];
    [key: string]: any;
  };
}

// ============================================
// FUNCIONES DE SUBIDA
// ============================================

/**
 * Obtiene URL presignada para subir archivo a ControlFile
 */
async function getPresignedUrl(
  file: File,
  parentId: string | null = null
): Promise<{
  uploadSessionId: string;
  url: string;
  bucketKey: string;
}> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  const response = await fetch(`${BACKEND_URL}/api/uploads/presign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime: file.type,
      parentId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener URL presignada');
  }

  return await response.json();
}

/**
 * Sube archivo físico a B2
 */
async function uploadFileToB2(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!response.ok) {
    throw new Error('Error al subir archivo a B2');
  }
}

/**
 * Confirma upload en ControlFile y crea metadatos
 */
async function confirmUpload(
  uploadSessionId: string
): Promise<{ fileId: string; bucketKey: string }> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  const response = await fetch(`${BACKEND_URL}/api/uploads/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uploadSessionId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al confirmar upload');
  }

  const data = await response.json();
  
  // Obtener información completa del archivo
  const fileInfoResponse = await fetch(
    `${BACKEND_URL}/api/files/${data.fileId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!fileInfoResponse.ok) {
    throw new Error('Error al obtener información del archivo');
  }

  const fileInfo = await fileInfoResponse.json();
  
  return {
    fileId: data.fileId,
    bucketKey: fileInfo.bucketKey,
  };
}

/**
 * Obtiene información completa de un archivo desde ControlFile
 */
async function getFileInfoFromControlFile(fileId: string): Promise<ControlFileMetadata> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  const response = await fetch(`${BACKEND_URL}/api/files/${fileId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Error al obtener información del archivo');
  }

  return await response.json();
}

// ============================================
// FUNCIONES DE SINCRONIZACIÓN
// ============================================

/**
 * Sincroniza metadatos de ControlFile a tu propio Firestore
 */
async function syncToMyFirestore(
  fileMetadata: ControlFileMetadata,
  customFields?: Record<string, any>
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('Usuario no autenticado');
  }

  const myFileData: MyFileMetadata = {
    ...fileMetadata,
    controlFileId: fileMetadata.id,
    syncedAt: new Date(),
    source: 'controlfile',
    customFields: customFields || {},
  };

  // Usar el mismo ID que ControlFile o generar uno nuevo
  const myFileId = fileMetadata.id; // O puedes usar: `my_${fileMetadata.id}`

  await setDoc(doc(myDb, 'files', myFileId), myFileData);
}

/**
 * Función principal: Sube archivo y sincroniza
 */
export async function uploadAndSync(
  file: File,
  parentId: string | null = null,
  customFields?: Record<string, any>
): Promise<{ controlFileId: string; myFileId: string }> {
  try {
    // 1. Obtener URL presignada
    console.log('📤 Obteniendo URL presignada...');
    const presignData = await getPresignedUrl(file, parentId);

    // 2. Subir archivo físico a B2
    console.log('⬆️ Subiendo archivo a B2...');
    await uploadFileToB2(presignData.url, file);

    // 3. Confirmar upload en ControlFile
    console.log('✅ Confirmando upload en ControlFile...');
    const { fileId, bucketKey } = await confirmUpload(presignData.uploadSessionId);

    // 4. Obtener información completa del archivo
    console.log('📋 Obteniendo información del archivo...');
    const fileInfo = await getFileInfoFromControlFile(fileId);

    // 5. Sincronizar a tu propio Firestore
    console.log('🔄 Sincronizando a mi Firestore...');
    await syncToMyFirestore(fileInfo, customFields);

    console.log('✅ Archivo subido y sincronizado exitosamente!');
    
    return {
      controlFileId: fileId,
      myFileId: fileId, // O el ID que uses en tu Firestore
    };
  } catch (error) {
    console.error('❌ Error en uploadAndSync:', error);
    throw error;
  }
}

// ============================================
// FUNCIONES DE GESTIÓN
// ============================================

/**
 * Elimina archivo de ControlFile y tu Firestore
 */
export async function deleteFileFromBothSystems(fileId: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  // 1. Eliminar de ControlFile
  const deleteResponse = await fetch(
    `${BACKEND_URL}/api/files/${fileId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!deleteResponse.ok) {
    throw new Error('Error al eliminar archivo de ControlFile');
  }

  // 2. Eliminar de tu Firestore
  await deleteDoc(doc(myDb, 'files', fileId));
}

/**
 * Actualiza metadatos en ambos sistemas
 */
export async function updateFileMetadata(
  fileId: string,
  updates: Partial<MyFileMetadata>
): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Usuario no autenticado');
  }

  // 1. Actualizar en ControlFile (si tiene API para esto)
  // Nota: ControlFile puede no tener API para actualizar metadatos
  // En ese caso, solo actualiza en tu Firestore

  // 2. Actualizar en tu Firestore
  const fileRef = doc(myDb, 'files', fileId);
  await updateDoc(fileRef, {
    ...updates,
    updatedAt: new Date(),
  });
}

// ============================================
// EJEMPLO DE USO
// ============================================

/**
 * Ejemplo de uso en un componente React
 */
export async function exampleUsage() {
  // 1. Autenticar usuario
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);

  // 2. Seleccionar archivo (en un input file)
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      // 3. Subir y sincronizar
      const result = await uploadAndSync(
        file,
        null, // parentId (null = raíz)
        {
          category: 'documentos',
          tags: ['importante', 'legal'],
          description: 'Documento importante',
        }
      );

      console.log('Archivo subido:', result);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  fileInput.click();
}

// ============================================
// HOOKS PARA REACT (OPCIONAL)
// ============================================

import { useState } from 'react';

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const upload = async (
    file: File,
    parentId: string | null = null,
    customFields?: Record<string, any>
  ) => {
    setUploading(true);
    setError(null);

    try {
      const result = await uploadAndSync(file, parentId, customFields);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error desconocido');
      setError(error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}

