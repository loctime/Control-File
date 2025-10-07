# 🔧 Script de Inicialización de Usuarios

## 📋 Propósito

Este script inicializa usuarios en el Firestore de ControlFile, creando el documento con cuota de almacenamiento necesario para que puedan usar el sistema.

## ⚠️ ¿Cuándo usarlo?

### Situaciones:

1. **Nuevo usuario manual**: Cuando se crea un usuario directamente en Firebase Auth y necesita ser inicializado
2. **Migración de usuarios**: Después de importar usuarios al Auth Central
3. **Error "User not found"**: Cuando un usuario autenticado no tiene documento en Firestore
4. **Cambio de cuota**: Cuando necesitas actualizar la cuota de un usuario (con flags adicionales)

### No es necesario si:

- ❌ El usuario se autentica por primera vez → **Auto-inicialización automática** (desde el middleware)
- ❌ Solo necesitas asignar claims → Usa `set-claims.js`

## 🚀 Uso

### Inicializar un Usuario

```bash
# Con cuota por defecto (5GB)
node scripts/init-user.js --uid YS4hCC54WAhj9m0u4fojTaDEpT72 --email d@gmail.com

# Con cuota personalizada (10GB)
node scripts/init-user.js --uid ABC123... --email user@example.com --quota 10
```

### Inicializar Múltiples Usuarios (Batch)

**1. Crear archivo CSV:**

`users.csv`:
```csv
uid,email,quota
YS4hCC54WAhj9m0u4fojTaDEpT72,user1@example.com,5
ABC123DEF456GHI789,user2@example.com,10
XYZ987UVW654TSR321,user3@example.com,5
```

**2. Ejecutar:**

```bash
node scripts/init-user.js --batch users.csv
```

**Salida esperada:**
```
📋 Procesando archivo: users.csv

✅ Usuario inicializado: YS4hCC54WAhj9m0u4fojTaDEpT72
   Email: user1@example.com
   Cuota: 5 GB

✅ Usuario inicializado: ABC123DEF456GHI789
   Email: user2@example.com
   Cuota: 10 GB

⚠️  Usuario ya existe: XYZ987UVW654TSR321
   Email: user3@example.com
   Cuota: 5.00 GB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Resumen:
   ✅ Creados: 2
   ⚠️  Ya existían: 1
   ❌ Errores: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📚 Parámetros

| Parámetro | Descripción | Requerido | Default |
|-----------|-------------|-----------|---------|
| `--uid` | UID del usuario en Firebase Auth | Sí (o --batch) | - |
| `--email` | Email del usuario | Sí (o --batch) | - |
| `--quota` | Cuota en GB | No | 5 |
| `--batch` | Archivo CSV con usuarios | No | - |

## 🔍 Qué Hace el Script

1. Verifica si el usuario ya existe en Firestore
2. Si existe, muestra info y termina
3. Si no existe, crea documento con:
   ```javascript
   {
     planQuotaBytes: [quota en bytes],
     usedBytes: 0,
     pendingBytes: 0,
     createdAt: [timestamp],
     email: [email del usuario]
   }
   ```

## 🆚 Auto-Inicialización vs Script Manual

### Auto-Inicialización (Automático) ⚡

**Cuándo:** Primera autenticación del usuario

**Cómo funciona:**
```
Usuario se autentica → Middleware auth.js 
→ Verifica si existe en Firestore 
→ Si no existe, crea automáticamente
```

**Ventajas:**
- ✅ Completamente automático
- ✅ Sin intervención manual
- ✅ Cuota por defecto desde .env

**Configuración:**
```env
# backend/.env
DEFAULT_USER_QUOTA_GB=5
```

### Script Manual (init-user.js) 🔧

**Cuándo:** 
- Después de migración masiva de usuarios
- Necesitas cuota específica diferente al default
- Usuario existe pero no tiene documento (edge case)

**Ventajas:**
- ✅ Control total sobre cuota
- ✅ Batch processing
- ✅ Verificación explícita

## 📋 Ejemplo Completo: Post-Migración

**Escenario:** Acabas de importar 100 usuarios al Auth Central

**Paso 1:** Exportar UIDs y emails

```bash
# En Firebase Console, exporta los usuarios
firebase auth:export migrated-users.json --project controlstorage-eb796
```

**Paso 2:** Extraer solo uid y email (con script o manual)

```bash
# Con jq (Linux/Mac)
cat migrated-users.json | jq -r '.users[] | [.localId, .email, "5"] | @csv' > users.csv

# O manualmente en Excel/Google Sheets:
# Columna A: uid
# Columna B: email  
# Columna C: quota (5, 10, etc.)
```

**Paso 3:** Inicializar todos

```bash
node scripts/init-user.js --batch users.csv
```

## ⚠️ Troubleshooting

### Error: "FB_ADMIN_APPDATA no está configurada"

**Causa:** Falta variable de entorno

**Solución:**
```bash
# Verificar que existe backend/.env con:
FB_ADMIN_APPDATA={"type":"service_account",...}
FB_DATA_PROJECT_ID=controlfile-data
```

### Error: "User not found in Firestore"

**Causa:** Este es el error que el script SOLUCIONA

**Solución:**
```bash
# Ejecutar el script con el UID del usuario
node scripts/init-user.js --uid [UID] --email [EMAIL]
```

### Advertencia: "Usuario ya existe"

**No es error**, solo información. El usuario ya está inicializado.

## 🔗 Scripts Relacionados

| Script | Propósito |
|--------|-----------|
| `set-claims.js` | Asignar permisos de apps (allowedApps) |
| `init-user.js` | **Inicializar cuota de almacenamiento** ← Este |
| `reconcile.js` | Verificar y corregir cuotas existentes |
| `verify-firebase-setup.js` | Verificar configuración general |

## 💡 Flujo Recomendado para Nuevas Integraciones

```
1. Migración de usuarios (MIGRACION_USUARIOS.md)
   ↓
2. Asignar claims (set-claims.js)
   ↓
3. Inicializar cuotas (init-user.js --batch)
   ↓
4. Verificar (reconcile.js --check)
   ↓
5. ✅ Usuarios listos para usar ControlFile
```

## 📞 Soporte

Para problemas con la inicialización de usuarios:
1. Verificar variables de entorno (backend/.env)
2. Verificar que el usuario existe en Auth Central
3. Revisar logs del script
4. Contactar a admin del sistema

---

**Versión**: 1.0  
**Última actualización**: Octubre 2025  
**Mantenido por**: Equipo ControlFile

