# Integración Backblaze B2 - Documentación Completa

Esta documentación describe la implementación real y documentada de la integración con Backblaze B2 en ControlFile.

---

## 📋 Tabla de Contenidos

1. [Configuración del Bucket](#configuración-del-bucket)
2. [Funciones de Upload](#funciones-de-upload)
3. [Naming de Carpetas/Keys](#naming-de-carpetaskeys)
4. [Generación de URLs de Acceso](#generación-de-urls-de-acceso)
5. [Estructura de Datos en Firestore](#estructura-de-datos-en-firestore)
6. [Flujo Completo](#flujo-completo)
7. [Código de Referencia](#código-de-referencia)

---

## 🔧 Configuración del Bucket

### Variables de Entorno Requeridas

```typescript
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_KEY_ID=<tu_key_id>
B2_APPLICATION_KEY=<tu_application_key>
B2_BUCKET_NAME=<nombre_del_bucket>
```

### Configuración del Cliente S3

```8:17:lib/b2.ts
const s3Client = new S3Client({
  region: 'us-west-004',
  endpoint: process.env.B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
  forcePathStyle: true,
  maxAttempts: 3, // Reintentos automáticos del SDK
});
```

**Ubicación:** `lib/b2.ts`

**Características:**
- Usa el SDK de AWS S3 (compatible con B2)
- `forcePathStyle: true` para compatibilidad con B2
- Reintentos automáticos configurados (3 intentos)
- Región extraída del endpoint si es necesario

---

## 📤 Funciones de Upload

### 1. Upload Directo desde Servidor

**Función:** `uploadFileDirectly`

```258:280:lib/b2.ts
export async function uploadFileDirectly(
  key: string,
  buffer: Buffer | Uint8Array,
  contentType?: string
): Promise<{ etag: string; versionId?: string }> {
  return withRetry(async () => {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    const response = await s3Client.send(command);
    
    logger.info('B2 file uploaded directly', { key, contentType });
    
    return {
      etag: response.ETag?.replace(/"/g, '') || '',
      versionId: response.VersionId,
    };
  }, 'uploadFileDirectly');
}
```

**Uso:** Para uploads desde el backend (proxy upload)

### 2. Presigned URL para Upload (Cliente Directo)

**Función:** `createPresignedPutUrl`

```64:76:lib/b2.ts
export async function createPresignedPutUrl(
  key: string,
  expiresIn: number = 3600,
  contentType?: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}
```

**Parámetros:**
- `key`: Ruta del archivo en B2
- `expiresIn`: Tiempo de expiración en segundos (default: 3600 = 1 hora)
- `contentType`: Tipo MIME del archivo (opcional)

**Uso:** Para uploads directos desde el cliente al bucket

### 3. Upload Multipart (Archivos Grandes)

**Umbral:** 128MB

```217:237:lib/b2.ts
export function calculateMultipartConfig(fileSize: number) {
  if (fileSize < MULTIPART_THRESHOLD) {
    return null; // Use regular upload
  }

  const maxParts = 10000; // B2 limit
  const minPartSize = 5 * 1024 * 1024; // 5MB minimum
  const maxPartSize = 5 * 1024 * 1024 * 1024; // 5GB maximum

  let partSize = Math.ceil(fileSize / maxParts);
  partSize = Math.max(partSize, minPartSize);
  partSize = Math.min(partSize, maxPartSize);

  const totalParts = Math.ceil(fileSize / partSize);

  return {
    partSize,
    totalParts,
    useMultipart: true,
  };
}
```

**Funciones relacionadas:**
- `createMultipartUpload`: Inicia el upload multipart
- `createPresignedUploadPartUrl`: Genera URL para cada parte
- `completeMultipartUpload`: Completa el upload
- `abortMultipartUpload`: Cancela el upload

---

## 📁 Naming de Carpetas/Keys

### Función de Generación de Keys

```370:380:backend/src/routes/upload.js
function generateFileKey(userId, parentPath, fileName) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substr(2, 9);
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  if (parentPath) {
    return `${userId}/${parentPath}/${timestamp}_${randomId}_${sanitizedFileName}`;
  }
  
  return `${userId}/${timestamp}_${randomId}_${sanitizedFileName}`;
}
```

**Formato del Key:**

```
{userId}/{parentPath}/{timestamp}_{randomId}_{sanitizedFileName}
```

**Ejemplos:**

```
user123/1234567890_abc123_documento.pdf
user123/carpeta1/subcarpeta/1234567890_xyz789_imagen.jpg
```

**Características:**
- Prefijo con `userId` para aislamiento por usuario
- `parentPath` refleja la estructura de carpetas
- Timestamp para ordenamiento temporal
- ID aleatorio para evitar colisiones
- Nombre sanitizado (solo caracteres alfanuméricos, puntos y guiones)

### Resolución del Parent Path

```14:39:backend/src/services/metadata.js
async function resolveParentAndAncestors(uid, parentId) {
  if (parentId) {
    const parent = await getFolderDoc(parentId);
    if (!parent) {
      console.warn(`⚠️ Carpeta padre no encontrada: ${parentId}, usando raíz`);
      return {
        parentId: null,
        path: '',
        ancestors: [],
      };
    }
    const parentAncestors = Array.isArray(parent.data.ancestors) ? parent.data.ancestors : [];
    return {
      parentId,
      path: parent.data.path || '',
      ancestors: [...parentAncestors, parentId],
    };
  }

  // Siempre usar raíz clásica (parentId null)
  return {
    parentId: null,
    path: '',
    ancestors: [],
  };
}
```

---

## 🔗 Generación de URLs de Acceso

### 1. URL Presignada para Descarga

**Función:** `createPresignedGetUrl`

```98:108:lib/b2.ts
export async function createPresignedGetUrl(
  key: string,
  expiresIn: number = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}
```

**Parámetros:**
- `key`: Ruta del archivo en B2 (`bucketKey`)
- `expiresIn`: Tiempo de expiración en segundos (default: 300 = 5 minutos)

**Uso en el Backend:**

```185:192:backend/src/routes/files.js
    // Generate presigned URL
    const downloadUrl = await b2Service.createPresignedGetUrl(key, 300); // 5 minutes

    res.json({ 
      downloadUrl,
      fileName: fileData.name,
      fileSize: fileData.size
    });
```

### 2. URL Pública Directa (No Implementada)

**Nota:** ControlFile NO usa URLs públicas directas. Todos los accesos son mediante URLs presignadas.

### 3. Vía CDN (No Implementada)

**Nota:** No hay configuración de CDN en la implementación actual. Los archivos se sirven directamente desde B2 mediante URLs presignadas.

### 4. Duración/Expiración

**Upload URLs:**
- Default: 3600 segundos (1 hora)
- Configurable por parámetro

**Download URLs:**
- Default: 300 segundos (5 minutos)
- Configurable por parámetro
- Cache en frontend: 5 minutos (`staleTime`)

**Cache en Frontend:**

```44:48:hooks/useFileDownloadUrl.ts
    enabled: !!user && !!fileId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos: no refetch al reabrir rápidamente el panel
    refetchOnWindowFocus: false,
    retry: 1,
    gcTime: 30 * 60 * 1000, // v5 usa gcTime en lugar de cacheTime
```

---

## 💾 Estructura de Datos en Firestore

### Colección: `files`

**Campos Obligatorios:**

```208:222:backend/src/routes/upload.js
    await fileRef.set({
      id: fileRef.id,
      userId: uid, // Cambiar de uid a userId para consistencia
      name: sessionData.name,
      size: sessionData.size,
      mime: sessionData.mime,
      parentId: sessionData.parentId,
      bucketKey: sessionData.bucketKey,
      etag: etag || metadata.etag,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      // appCode eliminado
      ancestors: Array.isArray(sessionData.ancestors) ? sessionData.ancestors : [],
    });
```

**Estructura Completa del Documento:**

```typescript
{
  id: string;                    // ID del documento (mismo que doc.id)
  userId: string;                 // ID del usuario propietario
  name: string;                   // Nombre del archivo
  size: number;                   // Tamaño en bytes
  mime: string;                   // Tipo MIME (ej: "image/jpeg")
  parentId: string | null;        // ID de la carpeta padre (null = raíz)
  bucketKey: string;              // ⭐ CLAVE: Ruta del archivo en B2
  etag: string;                   // ETag del archivo en B2
  type: 'file' | 'folder';       // Tipo de elemento
  createdAt: Timestamp;           // Fecha de creación
  updatedAt: Timestamp;           // Fecha de última actualización
  deletedAt: Timestamp | null;    // Fecha de eliminación (soft delete)
  ancestors: string[];            // Array de IDs de carpetas ancestros
}
```

### Colección: `uploadSessions`

**Campos de la Sesión de Upload:**

```139:152:backend/src/routes/upload.js
    await sessionRef.set({
      uid,
      size,
      parentId: effectiveParentId || null,
      name,
      mime,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      bucketKey: fileKey,
      uploadId: uploadSessionData.multipart?.uploadId || null,
      // appCode eliminado
      ancestors,
    });
```

**Estados de la Sesión:**
- `pending`: Sesión creada, esperando upload
- `uploaded`: Archivo subido a B2
- `confirmed`: Archivo confirmado y registrado en Firestore
- `completed`: Proceso completo

### Relación con Files

**Relación:**
- Un documento en `files` representa un archivo físico en B2
- El campo `bucketKey` es la referencia única al archivo físico
- Múltiples documentos pueden referenciar el mismo `bucketKey` (compartir archivo)

**Búsqueda de Archivos:**

```45:74:backend/src/routes/files.js
      // Get files from 'files' collection
      let filesQuery = admin.firestore()
        .collection('files')
        .where('userId', '==', uid)
        .where('deletedAt', '==', null);

      if (parentId === null) {
        filesQuery = filesQuery.where('parentId', '==', null);
      } else if (typeof parentId === 'string' && parentId.length > 0) {
        filesQuery = filesQuery.where('parentId', '==', parentId);
      }

      // Ya no filtramos por appCode - todos los archivos del usuario

      filesQuery = filesQuery.orderBy('updatedAt', 'desc');

      if (cursor) {
        const afterDoc = await admin.firestore().collection('files').doc(cursor).get();
        if (afterDoc.exists) {
          filesQuery = filesQuery.startAfter(afterDoc);
        }
      }

      const filesSnap = await filesQuery.limit(limit).get();
      filesSnap.forEach(doc => {
        items.push({ 
          id: doc.id, 
          ...doc.data(),
          type: 'file' // Asegurar que tenga el tipo correcto
        });
      });
```

### Campos Usados por el Frontend

**Hook:** `useFileDownloadUrl`

```7:52:hooks/useFileDownloadUrl.ts
export function useFileDownloadUrl(fileId: string | null, enabled: boolean = true) {
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: ['downloadUrl', user?.uid || 'no-user', fileId || 'no-file'],
    queryFn: async (): Promise<string> => {
      if (!fileId) throw new Error('Archivo inválido');

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Usuario no autenticado');
      }

      const token = await currentUser.getIdToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

      const response = await fetch(`${backendUrl}/api/files/presign-get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data = await response.json();
      if (!data.downloadUrl) {
        throw new Error('No se pudo generar la URL de descarga');
      }
      return data.downloadUrl as string;
    },
    enabled: !!user && !!fileId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutos: no refetch al reabrir rápidamente el panel
    refetchOnWindowFocus: false,
    retry: 1,
    gcTime: 30 * 60 * 1000, // v5 usa gcTime en lugar de cacheTime
  });

  return { downloadUrl: (query.data as string) || null, loading: query.isLoading, error: (query.error as any)?.message || null };
}
```

**Campos utilizados:**
- `id`: Para identificar el archivo
- `name`: Para mostrar el nombre
- `size`: Para mostrar el tamaño
- `mime`: Para determinar el tipo de archivo
- `bucketKey`: Para generar la URL presignada (en el backend)

---

## 🔄 Flujo Completo

### Flujo: Archivo → Backblaze → Firestore → Visualización

#### 1. **Inicio del Upload**

**Endpoint:** `POST /api/uploads/presign`

```31:161:backend/src/routes/upload.js
router.post('/presign', async (req, res) => {
  try {
    logger.debug('Presign request', { 
      headers: req.headers, 
      body: req.body, 
      user: req.user,
      contentType: req.headers['content-type']
    });
    
    const {
      name: nameDirect,
      fileName,
      size: sizeDirect,
      fileSize,
      mime: mimeDirect,
      mimeType,
      parentId,
    } = req.body;
    const name = nameDirect || fileName;
    const size = (typeof sizeDirect === 'number' ? sizeDirect : undefined) ?? fileSize;
    const mime = mimeDirect || mimeType;
    const { uid } = req.user;

    logger.debug('Parsed upload data', { name, size, mime, parentId, uid });

    if (!name || !size || !mime) {
      logger.warn('Missing required fields', { name: !!name, size: !!size, mime: !!mime });
      return res.status(400).json({ error: 'Faltan parámetros requeridos', message: 'name/fileName, size/fileSize y mime/mimeType son obligatorios' });
    }

    // Validate file size (max 5GB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
    if (size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'El archivo es demasiado grande (máx. 5GB)' });
    }

    // Get user quota information
    logger.debug('Getting user quota', { uid });
    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      logger.warn('User not found in Firestore', { uid });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const userData = userDoc.data();
    const { planQuotaBytes, usedBytes, pendingBytes } = userData;
    
    logger.debug('User quota data', { planQuotaBytes, usedBytes, pendingBytes, requestedSize: size });

    // Check if user has enough quota
    const totalUsed = usedBytes + pendingBytes + size;
    if (totalUsed > planQuotaBytes) {
      return res.status(413).json({ 
        error: 'No tienes suficiente espacio disponible',
        details: {
          requested: size,
          available: planQuotaBytes - usedBytes - pendingBytes,
          total: planQuotaBytes
        }
      });
    }

    // Resolve parent and ancestors
    logger.debug('Resolving parent folder', { parentId, uid });
    const resolved = await resolveParentAndAncestors(uid, parentId);
    const parentPath = resolved.path || '';
    const effectiveParentId = resolved.parentId || parentId || null;
    const ancestors = resolved.ancestors || [];
    logger.debug('Resolved parent info', { parentPath, effectiveParentId, ancestors });

    // Generate file key
    const fileKey = generateFileKey(uid, parentPath, name);

    // Check if multipart upload is needed
    const multipartConfig = b2Service.calculateMultipartConfig(size);
    let uploadSessionData = {
      uploadSessionId: Math.random().toString(36).substr(2, 9),
      key: fileKey,
      url: '',
    };

    if (multipartConfig?.useMultipart) {
      // Create multipart upload
      const uploadId = await b2Service.createMultipartUpload(fileKey, mime);
      
      // Generate presigned URLs for each part
      const parts = [];
      for (let i = 1; i <= multipartConfig.totalParts; i++) {
        const partUrl = await b2Service.createPresignedUploadPartUrl(fileKey, uploadId, i);
        parts.push({
          partNumber: i,
          url: partUrl,
        });
      }

      uploadSessionData.multipart = {
        uploadId,
        parts,
      };
    } else {
      // Single upload
      uploadSessionData.url = await b2Service.createPresignedPutUrl(fileKey, 3600, mime);
    }

    // Create upload session in Firestore
    const sessionRef = admin.firestore().collection('uploadSessions').doc(uploadSessionData.uploadSessionId);
    await sessionRef.set({
      uid,
      size,
      parentId: effectiveParentId || null,
      name,
      mime,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      bucketKey: fileKey,
      uploadId: uploadSessionData.multipart?.uploadId || null,
      // appCode eliminado
      ancestors,
    });

    // Lógica de taskbar eliminada - ya no necesitamos APP_CODE

    // Update user's pending bytes
    await userRef.update({
      pendingBytes: pendingBytes + size,
    });

    res.json(uploadSessionData);
```

**Pasos:**
1. Validar parámetros (name, size, mime)
2. Verificar cuota del usuario
3. Resolver carpeta padre y ancestros
4. Generar `bucketKey` único
5. Decidir si usar multipart (archivos > 128MB)
6. Generar URL presignada o URLs multipart
7. Crear sesión en `uploadSessions`
8. Reservar espacio (`pendingBytes`)

#### 2. **Upload a Backblaze B2**

**Opción A: Upload Directo (Cliente → B2)**

El cliente usa la URL presignada para subir directamente a B2:

```javascript
// En el frontend
const response = await fetch(presignedUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': mimeType,
  },
});
```

**Opción B: Proxy Upload (Cliente → Backend → B2)**

```312:336:backend/src/routes/upload.js
    // Subir archivo a B2 usando el backend
    const uploadResult = await b2Service.uploadFileDirectly(
      sessionData.bucketKey,
      fileToUpload,
      mimeToUpload
    );

    logger.info('File uploaded to B2 successfully', { 
      fileName: sessionData.name, 
      fileId: uploadResult.fileId,
      userId: req.user?.uid 
    });

    // Actualizar estado de la sesión
    await sessionRef.update({
      status: 'uploaded',
      uploadedAt: new Date(),
      etag: uploadResult.etag,
      virusScan: virusScanResult
    });

    res.json({ 
      success: true, 
      message: 'Archivo subido correctamente',
      etag: uploadResult.etag 
    });
```

#### 3. **Confirmación y Registro en Firestore**

**Endpoint:** `POST /api/uploads/confirm`

```169:246:backend/src/routes/upload.js
router.post('/confirm', async (req, res) => {
  try {
    const { uploadSessionId, etag, parts } = req.body;
    const { uid } = req.user;

    if (!uploadSessionId) {
      return res.status(400).json({ error: 'ID de sesión requerido' });
    }

    // Get upload session
    const sessionRef = admin.firestore().collection('uploadSessions').doc(uploadSessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Sesión de subida no encontrada' });
    }

    const sessionData = sessionDoc.data();
    if (sessionData.uid !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (sessionData.status !== 'pending' && sessionData.status !== 'uploaded') {
      return res.status(400).json({ error: 'Sesión ya procesada' });
    }

    // Complete multipart upload if needed
    if (sessionData.uploadId && parts) {
      await b2Service.completeMultipartUpload(sessionData.bucketKey, sessionData.uploadId, parts);
    }

    // Verify file exists in B2
    const metadata = await b2Service.getObjectMetadata(sessionData.bucketKey);
    if (!metadata) {
      return res.status(400).json({ error: 'Archivo no encontrado en B2' });
    }

    // Create file record in Firestore
    const fileRef = admin.firestore().collection('files').doc();
    await fileRef.set({
      id: fileRef.id,
      userId: uid, // Cambiar de uid a userId para consistencia
      name: sessionData.name,
      size: sessionData.size,
      mime: sessionData.mime,
      parentId: sessionData.parentId,
      bucketKey: sessionData.bucketKey,
      etag: etag || metadata.etag,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      // appCode eliminado
      ancestors: Array.isArray(sessionData.ancestors) ? sessionData.ancestors : [],
    });

    // Update user quota
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.update({
      usedBytes: admin.firestore.FieldValue.increment(sessionData.size),
      pendingBytes: admin.firestore.FieldValue.increment(-sessionData.size),
    });

    // Update session status
    await sessionRef.update({
      status: 'completed',
      completedAt: new Date(),
    });

    res.json({ 
      success: true, 
      fileId: fileRef.id,
      message: 'Archivo subido exitosamente'
    });
```

**Pasos:**
1. Validar sesión de upload
2. Completar multipart si aplica
3. Verificar que el archivo existe en B2
4. Crear documento en `files` con todos los metadatos
5. Actualizar cuota del usuario (`pendingBytes` → `usedBytes`)
6. Marcar sesión como `completed`

#### 4. **Visualización en ControlFile**

**Paso 1: Obtener Lista de Archivos**

```45:74:backend/src/routes/files.js
      // Get files from 'files' collection
      let filesQuery = admin.firestore()
        .collection('files')
        .where('userId', '==', uid)
        .where('deletedAt', '==', null);

      if (parentId === null) {
        filesQuery = filesQuery.where('parentId', '==', null);
      } else if (typeof parentId === 'string' && parentId.length > 0) {
        filesQuery = filesQuery.where('parentId', '==', parentId);
      }

      // Ya no filtramos por appCode - todos los archivos del usuario

      filesQuery = filesQuery.orderBy('updatedAt', 'desc');

      if (cursor) {
        const afterDoc = await admin.firestore().collection('files').doc(cursor).get();
        if (afterDoc.exists) {
          filesQuery = filesQuery.startAfter(afterDoc);
        }
      }

      const filesSnap = await filesQuery.limit(limit).get();
      filesSnap.forEach(doc => {
        items.push({ 
          id: doc.id, 
          ...doc.data(),
          type: 'file' // Asegurar que tenga el tipo correcto
        });
      });
```

**Paso 2: Generar URL de Descarga**

**Endpoint:** `POST /api/files/presign-get`

```140:192:backend/src/routes/files.js
router.post('/presign-get', async (req, res) => {
  try {
    const { fileId } = req.body;
    const { uid } = req.user;

    if (!fileId) {
      return res.status(400).json({ error: 'ID de archivo requerido' });
    }

    // Get file from Firestore
    const fileRef = admin.firestore().collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const fileData = fileDoc.data();
    if (fileData.userId !== uid) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!assertItemVisibleForApp(fileData)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (fileData.deletedAt) {
      return res.status(404).json({ error: 'Archivo eliminado' });
    }

    const key = fileData.bucketKey || fileData.key || fileData.objectKey;
    // Fallback: si no hay clave de B2 pero existe una URL absoluta (ej. controlAudit), usarla
    if (!key) {
      if (typeof fileData.url === 'string' && /^https?:\/\//i.test(fileData.url)) {
        logger.warn('Using direct URL due to missing bucketKey', { fileId, urlHost: (() => { try { return new URL(fileData.url).host; } catch (_) { return 'invalid'; } })() });
        return res.json({
          downloadUrl: fileData.url,
          fileName: fileData.name,
          fileSize: fileData.size,
        });
      }
      logger.warn('File without bucketKey/key', { fileId, hasBucketKey: !!fileData.bucketKey });
      return res.status(400).json({ error: 'Archivo sin clave de almacenamiento (bucketKey)' });
    }

    // Generate presigned URL
    const downloadUrl = await b2Service.createPresignedGetUrl(key, 300); // 5 minutes

    res.json({ 
      downloadUrl,
      fileName: fileData.name,
      fileSize: fileData.size
    });
```

**Paso 3: Usar URL en el Frontend**

El hook `useFileDownloadUrl` obtiene la URL presignada y la usa para mostrar/previsualizar el archivo.

---

## 📚 Código de Referencia

### Archivos Principales

1. **`lib/b2.ts`** - Funciones de B2 (presigned URLs, upload, delete)
2. **`backend/src/routes/upload.js`** - Endpoints de upload
3. **`backend/src/routes/files.js`** - Endpoints de descarga
4. **`backend/src/services/b2.js`** - Servicio B2 del backend
5. **`backend/src/services/metadata.js`** - Resolución de paths y ancestros
6. **`hooks/useFileDownloadUrl.ts`** - Hook para obtener URLs de descarga
7. **`app/api/uploads/presign/route.ts`** - API route de presign (Next.js)
8. **`app/api/uploads/confirm/route.v2.ts`** - API route de confirmación (Next.js)
9. **`app/api/files/presign-get/route.ts`** - API route de descarga (Next.js)

### Funciones Clave

- `generateFileKey()` - Genera la clave única para B2
- `createPresignedPutUrl()` - Genera URL para upload
- `createPresignedGetUrl()` - Genera URL para descarga
- `uploadFileDirectly()` - Upload directo desde servidor
- `resolveParentAndAncestors()` - Resuelve estructura de carpetas

---

## ✅ Resumen para Replicar en ControlAudit

### Checklist de Implementación

1. **Configuración B2:**
   - ✅ Variables de entorno (`B2_ENDPOINT`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`)
   - ✅ Cliente S3 configurado con `forcePathStyle: true`

2. **Generación de Keys:**
   - ✅ Formato: `{userId}/{parentPath}/{timestamp}_{randomId}_{sanitizedFileName}`
   - ✅ Sanitización de nombres de archivo

3. **Upload:**
   - ✅ Presigned URLs para upload directo
   - ✅ Soporte multipart para archivos grandes (>128MB)
   - ✅ Sesiones de upload en Firestore

4. **Firestore:**
   - ✅ Documento en `files` con campos obligatorios
   - ✅ Campo `bucketKey` como referencia única
   - ✅ Campos: `id`, `userId`, `name`, `size`, `mime`, `parentId`, `bucketKey`, `etag`, `createdAt`, `updatedAt`, `deletedAt`, `ancestors`

5. **Descarga:**
   - ✅ URLs presignadas con expiración (default: 5 minutos)
   - ✅ Cache en frontend (5 minutos)

6. **Cuota:**
   - ✅ `pendingBytes` durante upload
   - ✅ `usedBytes` después de confirmación

---

## 🔍 Notas Importantes

1. **No hay URLs públicas:** Todos los accesos son mediante URLs presignadas
2. **No hay CDN:** Los archivos se sirven directamente desde B2
3. **Soft delete:** Los archivos se marcan con `deletedAt` pero no se eliminan inmediatamente de B2
4. **Ancestros:** Se mantiene un array de IDs de carpetas ancestros para navegación rápida
5. **Compatibilidad:** El código soporta fallback a URLs directas si no hay `bucketKey` (para integraciones legacy)

---

**Última actualización:** Basado en el código actual de ControlFile

