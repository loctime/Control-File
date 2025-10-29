# ControlFile - Next.js + Firebase + B2 + Cloudflare

## Project Structure
```
controlfile/
├── README.md
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local.example
├── .env.local
├── firestore.rules
├── firestore.indexes.json
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── auth/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   ├── shared/
│   │   └── [id]/
│   │       └── page.tsx
│   └── api/
│       ├── uploads/
│       │   ├── presign/
│       │   │   └── route.ts
│       │   └── confirm/
│       │       └── route.ts
│       ├── files/
│       │   ├── delete/
│       │   │   └── route.ts
│       │   ├── move/
│       │   │   └── route.ts
│       │   ├── rename/
│       │   │   └── route.ts
│       │   └── presign-get/
│       │       └── route.ts
│       └── shares/
│           ├── create/
│           │   └── route.ts
│           └── revoke/
│               └── route.ts
├── components/
│   ├── ui/ (shadcn/ui components)
│   ├── drive/
│   │   ├── FileExplorer.tsx
│   │   ├── FileList.tsx
│   │   ├── FileGrid.tsx
│   │   ├── DetailsPanel.tsx
│   │   ├── Breadcrumb.tsx
│   │   ├── ContextMenu.tsx
│   │   ├── UploadProgress.tsx
│   │   ├── SearchBar.tsx
│   │   ├── Navbar.tsx
│   │   └── Taskbar.tsx
│   ├── auth/
│   │   └── AuthForm.tsx
│   └── common/
│       ├── ThemeToggle.tsx
│       └── QuotaBar.tsx
├── lib/
│   ├── firebase.ts
│   ├── b2.ts
│   ├── utils.ts
│   └── stores/
│       ├── auth.ts
│       ├── drive.ts
│       └── ui.ts
├── types/
│   └── index.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useFiles.ts
│   └── useUpload.ts
├── cloudflare/
│   ├── worker.js
│   └── wrangler.toml
├── scripts/
│   └── reconcile.js
└── tests/
    ├── __tests__/
    └── e2e/
```

## Environment Variables (.env.local)
```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (for server-side)
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your_project.iam.gserviceaccount.com

# Backblaze B2
B2_KEY_ID=your_b2_key_id
B2_APPLICATION_KEY=your_b2_application_key
B2_BUCKET_ID=your_b2_bucket_id
B2_BUCKET_NAME=your_b2_bucket_name
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com

# Cloudflare Worker
NEXT_PUBLIC_CLOUDFLARE_WORKER_URL=https://your-worker.your-subdomain.workers.dev

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Package.json
```json
{
  "name": "controlfile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "reconcile": "node scripts/reconcile.js",
    "test": "jest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18",
    "react-dom": "^18",
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "@tailwindcss/forms": "^0.5.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.263.1",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-context-menu": "^2.1.5",
    "firebase": "^10.12.2",
    "firebase-admin": "^12.1.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "zustand": "^4.5.2",
    "@tanstack/react-query": "^5.45.1",
    "react-dropzone": "^14.2.3",
    "react-pdf": "^9.1.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "eslint": "^8",
    "eslint-config-next": "14.2.5",
    "@types/jest": "^29.5.12",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "@playwright/test": "^1.44.1"
  }
}
```

## Next.js Config (next.config.js)
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    domains: ['s3.us-west-004.backblazeb2.com'],
    unoptimized: true
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  }
}

module.exports = nextConfig
```

## Tailwind Config (tailwind.config.js)
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/forms")],
}
```

## Firestore Rules (firestore.rules)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Files - only owner can access
    match /files/{fileId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Folders - only owner can access
    match /folders/{folderId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Upload sessions - only owner can access
    match /uploadSessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
    
    // Shares - public read if isPublic, owner can write
    match /shares/{shareId} {
      allow read: if resource.data.isPublic == true || 
                     (request.auth != null && request.auth.uid == resource.data.userId);
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

## Firestore Indexes (firestore.indexes.json)
```json
{
  "indexes": [
    {
      "collectionGroup": "files",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "parentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "files",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "name",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "folders",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "parentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "uploadSessions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "uid",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "expiresAt",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

## Setup Instructions

### 1. Firebase Setup
1. Create a new Firebase project
2. Enable Authentication (Google + Email/Password)
3. Create Firestore database
4. Generate service account key for admin SDK
5. Deploy firestore rules: `firebase deploy --only firestore:rules`

### 2. Backblaze B2 Setup
1. Create B2 account and bucket
2. Generate application key with read/write permissions
3. Configure CORS for your domain

### 3. Cloudflare Worker Setup
1. Install wrangler CLI: `npm install -g wrangler`
2. Deploy worker: `cd cloudflare && wrangler deploy`

### 4. Local Development
```bash
npm install
npm run dev
```

### 5. Production Deployment (Render)
1. Connect GitHub repository
2. Set environment variables
3. Deploy as Node.js service

## Sistema de Taskbar

### Componentes Principales
- **Navbar.tsx**: Navegación principal con carpetas de `source: "navbar"`
- **Taskbar.tsx**: Acceso rápido con carpetas de `source: "taskbar"`

### Diferenciación Visual
- **Navbar**: Marco morado (`border-purple-500`)
- **Taskbar**: Marco azul (`border-blue-500`)

### Estructura de Datos
```typescript
// Firestore: folders/{folderId}
{
  metadata: {
    source: "navbar" | "taskbar", // Identifica el origen
    isMainFolder: true,
    icon: "Folder" | "Taskbar",
    color: "text-purple-600" | "text-blue-600"
  }
}
```

### API Changes
- **POST /api/folders/create**: Nuevo parámetro `source` opcional
- **Endpoints taskbar**: Deprecated (ahora usa carpetas reales)

## Key Features Implementation Status
- [x] Project structure and configuration
- [x] Sistema de Taskbar separado del Navbar
- [x] Diferenciación visual con marcos de colores
- [x] Campo `metadata.source` en Firestore
- [ ] Authentication system
- [ ] File system components  
- [ ] Upload/download functionality
- [ ] Sharing system
- [ ] Cloudflare worker
- [ ] Reconciliation script
- [ ] Testing setup

Ready to implement the actual components and functionality!