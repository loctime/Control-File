# 🔧 Solución para el Error de Índice de Firestore

## ❌ Problema
El sistema está fallando con el error:
```
Error: 9 FAILED_PRECONDITION: The query requires an index
```

## ✅ Solución Rápida

### Opción 1: Usar el enlace directo (Más rápido)
1. Ve a este enlace: https://console.firebase.google.com/v1/r/project/controlstorage-eb796/firestore/indexes?create_composite=ClJwcm9qZWN0cy9jb250cm9sc3RvcmFnZS1lYjc5Ni9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvZmlsZXMvaW5kZXhlcy9fEAEaDQoJaXNEZWxldGVkEAEaDAoIcGFyZW50SWQQARoKCgZ1c2VySWQQARoNCgl1cGRhdGVkQXQQAhoMCghfX25hbWVfXxAC

2. Haz clic en "Create Index"

3. Espera a que se cree el índice (puede tardar unos minutos)

### Opción 2: Usar Firebase CLI
```bash
# 1. Instalar Firebase CLI (si no lo tienes)
npm install -g firebase-tools

# 2. Autenticarse
firebase login

# 3. Desplegar índices
firebase deploy --only firestore:indexes
```

## 📊 Detalles del Índice
El índice que se necesita es para la colección `files` con estos campos:
- `isDeleted` (ASCENDING)
- `parentId` (ASCENDING) 
- `userId` (ASCENDING)
- `updatedAt` (DESCENDING)

## ⏱️ Tiempo de Creación
Los índices de Firestore pueden tardar entre 2-10 minutos en estar disponibles después de crearlos.

## 🔍 Verificación
Una vez creado el índice, el error debería desaparecer y las consultas de archivos funcionarán correctamente.
