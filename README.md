# Mini-OneDrive

Una aplicación de almacenamiento en la nube estilo Windows con Next.js 14, Firebase, Backblaze B2 y Cloudflare Workers.

## 🚀 Características

- **Interfaz estilo Windows**: Navegación breadcrumb, vista lista/cuadrícula, panel de detalles
- **Autenticación**: Firebase Auth con Google y email/password
- **Almacenamiento**: Backblaze B2 con presigned URLs
- **Subida de archivos**: Drag & drop, multipart para archivos grandes
- **Compartir archivos**: Enlaces públicos con Cloudflare Workers
- **Sistema de cuotas**: Control de almacenamiento por usuario
- **Tema claro/oscuro**: Soporte para temas personalizables
- **Responsive**: Optimizado para móvil y desktop

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Lucide React
- **Estado**: Zustand, TanStack Query
- **Autenticación**: Firebase Auth
- **Base de datos**: Firestore
- **Storage**: Backblaze B2 (S3-compatible)
- **CDN**: Cloudflare Workers
- **Deploy**: Vercel/Render

## 📋 Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Cuenta de Firebase
- Cuenta de Backblaze B2
- Cuenta de Cloudflare (opcional)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/mini-onedrive.git
cd mini-onedrive
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia el archivo de ejemplo y configura tus variables:

```bash
cp env.example .env.local
```

Edita `.env.local` con tus credenciales:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (para server-side)
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com

# Backblaze B2
B2_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_application_key
B2_BUCKET_ID=your_b2_bucket_id
B2_BUCKET_NAME=your_b2_bucket_name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com

# Cloudflare Worker (opcional)
NEXT_PUBLIC_CLOUDFLARE_WORKER_URL=https://your-worker.your-subdomain.workers.dev

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Configurar Firebase

#### Crear proyecto Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita Authentication (Google + Email/Password)
4. Crea una base de datos Firestore
5. Genera una clave de servicio para Admin SDK

#### Desplegar reglas de Firestore

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar proyecto
firebase init firestore

# Desplegar reglas
firebase deploy --only firestore:rules
```

### 5. Configurar Backblaze B2

#### Crear bucket y aplicación

1. Ve a [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html)
2. Crea una cuenta y un bucket
3. Genera una clave de aplicación con permisos de lectura/escritura
4. Configura CORS para tu dominio

#### Configurar CORS en B2

```json
[
  {
    "corsRuleName": "mini-onedrive-cors",
    "allowedOrigins": ["http://localhost:3000", "https://tu-dominio.com"],
    "allowedOperations": ["s3_get", "s3_put", "s3_delete"],
    "allowedHeaders": ["*"],
    "maxAgeSeconds": 3600
  }
]
```

### 6. Configurar Cloudflare Worker (opcional)

#### Desplegar Worker

```bash
# Instalar Wrangler CLI
npm install -g wrangler

# Login a Cloudflare
wrangler login

# Configurar variables
cd cloudflare
wrangler secret put FIREBASE_ACCESS_TOKEN

# Desplegar
wrangler deploy
```

### 7. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno en el dashboard
3. Despliega automáticamente

### Render

1. Crea un nuevo servicio Web en Render
2. Conecta tu repositorio de GitHub
3. Configura las variables de entorno
4. Despliega

## 📁 Estructura del Proyecto

```
mini-onedrive/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── auth/              # Página de autenticación
│   ├── settings/          # Página de configuración
│   └── shared/            # Página de archivos compartidos
├── components/            # Componentes React
│   ├── ui/               # Componentes shadcn/ui
│   ├── drive/            # Componentes del explorador
│   └── common/           # Componentes comunes
├── lib/                  # Utilidades y configuración
│   ├── firebase.ts       # Configuración de Firebase
│   ├── b2.ts            # Cliente de Backblaze B2
│   ├── utils.ts         # Utilidades generales
│   └── stores/          # Stores de Zustand
├── hooks/               # Custom hooks
├── types/               # Definiciones de TypeScript
├── cloudflare/          # Worker de Cloudflare
├── scripts/             # Scripts de mantenimiento
└── firestore.rules      # Reglas de seguridad
```

## 🔐 Modelo de Datos

### Firestore Collections

#### users/{uid}
```typescript
{
  planQuotaBytes: number;    // Cuota total (5GB por defecto)
  usedBytes: number;         // Bytes usados
  pendingBytes: number;      // Bytes en subida
  createdAt: Timestamp;      // Fecha de creación
}
```

#### files/{id}
```typescript
{
  userId: string;            // ID del propietario
  bucketKey: string;         // Clave en B2
  name: string;              // Nombre del archivo
  size: number;              // Tamaño en bytes
  mime: string;              // Tipo MIME
  checksum: string;          // Checksum del archivo
  parentId: string | null;   // ID de la carpeta padre
  path: string;              // Ruta completa
  version: number;           // Versión del archivo
  createdAt: Timestamp;      // Fecha de creación
  modifiedAt: Timestamp;     // Fecha de modificación
  isShared: boolean;         // Si está compartido
}
```

#### folders/{id}
```typescript
{
  userId: string;            // ID del propietario
  name: string;              // Nombre de la carpeta
  parentId: string | null;   // ID de la carpeta padre
  path: string;              // Ruta completa
  createdAt: Timestamp;      // Fecha de creación
  modifiedAt: Timestamp;     // Fecha de modificación
}
```

#### shares/{id}
```typescript
{
  userId: string;            // ID del propietario
  fileId: string;            // ID del archivo
  role: 'viewer' | 'editor'; // Rol del compartir
  isPublic: boolean;         // Si es público
  expiresAt: Timestamp | null; // Fecha de expiración
  revocationCounter: number; // Contador de revocación
  createdAt: Timestamp;      // Fecha de creación
}
```

#### uploadSessions/{id}
```typescript
{
  uid: string;               // ID del usuario
  size: number;              // Tamaño del archivo
  parentId: string | null;   // ID de la carpeta padre
  name: string;              // Nombre del archivo
  mime: string;              // Tipo MIME
  status: 'pending' | 'confirmed' | 'failed';
  expiresAt: Timestamp;      // Fecha de expiración
  createdAt: Timestamp;      // Fecha de creación
  bucketKey: string;         // Clave en B2
  uploadId: string;          // ID de subida multipart
}
```

## 🔧 Scripts Disponibles

### Desarrollo
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Construir para producción
npm run start        # Servidor de producción
npm run lint         # Linting
```

### Mantenimiento
```bash
npm run reconcile    # Reconciliar cuotas de usuarios
```

### Testing
```bash
npm test             # Tests unitarios
npm run test:e2e     # Tests end-to-end
```

## 🛡️ Seguridad

- **Autenticación**: Firebase Auth con JWT
- **Autorización**: Reglas de Firestore por usuario
- **Storage**: Presigned URLs con expiración
- **CORS**: Configurado para dominios específicos
- **Validación**: Validación de entrada en todas las APIs

## 📊 Monitoreo y Mantenimiento

### Reconciliación de Cuotas

Ejecuta el script de reconciliación para verificar y corregir cuotas:

```bash
# Reconciliar todos los usuarios
npm run reconcile all

# Reconciliar usuario específico
npm run reconcile user123
```

### Limpieza de Sesiones

El script de reconciliación también limpia automáticamente las sesiones de subida expiradas.

## 📚 Documentación de Integración y API

- Guía de integración: ver `API_INTEGRATION.md`
- Referencia completa de endpoints: ver `API_REFERENCE.md`

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:

1. Revisa la [documentación](https://github.com/tu-usuario/mini-onedrive/wiki)
2. Busca en los [issues](https://github.com/tu-usuario/mini-onedrive/issues)
3. Crea un nuevo issue si no encuentras la solución

## 🙏 Agradecimientos

- [Next.js](https://nextjs.org/) - Framework de React
- [Firebase](https://firebase.google.com/) - Backend como servicio
- [Backblaze B2](https://www.backblaze.com/b2/) - Almacenamiento en la nube
- [Cloudflare](https://cloudflare.com/) - CDN y Workers
- [shadcn/ui](https://ui.shadcn.com/) - Componentes de UI
- [Tailwind CSS](https://tailwindcss.com/) - Framework de CSS

---

Hecho con ❤️ para la comunidad de desarrolladores
