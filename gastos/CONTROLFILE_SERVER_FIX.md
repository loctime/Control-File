# 🔧 Fix para ControlFile Server - Cambio de uid a userId

## ❌ Problema
El endpoint `/api/shares/create` devuelve error 403 (Forbidden) porque hay una inconsistencia en el código del servidor.

## 🔍 Causa
En el código del servidor de ControlFile, se está usando `fileData.uid` cuando debería ser `fileData.userId`.

## ✅ Solución
Cambiar todas las referencias de `fileData.uid` por `fileData.userId` en el servidor.

### 📋 Archivos a modificar en el servidor:

#### 1. **Endpoint `/api/shares/create`:**
```javascript
// ❌ Código actual (incorrecto):
if (fileData.uid !== uid) {
  return res.status(403).json({ error: 'No autorizado' });
}

// ✅ Código corregido:
if (fileData.userId !== uid) {
  return res.status(403).json({ error: 'No autorizado' });
}
```

#### 2. **Buscar otros lugares con el mismo problema:**
```bash
# En el servidor, buscar:
grep -r "fileData.uid" .
grep -r ".uid !== uid" .
grep -r "fileData\.uid" .
```

#### 3. **Cambiar todas las ocurrencias:**
```javascript
// ❌ Antes:
const fileData = fileDoc.data();
if (fileData.uid !== uid) {
  return res.status(403).json({ error: 'No autorizado' });
}

// ✅ Después:
const fileData = fileDoc.data();
if (fileData.userId !== uid) {
  return res.status(403).json({ error: 'No autorizado' });
}
```

## 🔍 Verificación
Después del cambio, verificar que:
1. El endpoint `/api/shares/create` funcione correctamente
2. No se rompan otros endpoints
3. La autenticación siga funcionando

## 📊 Logs esperados después del fix:
```
🔍 Global middleware - Path: /api/shares/create
🔍 Global middleware - Method: POST
✅ Share link created: { shareUrl: "...", shareToken: "..." }
```

## 🎯 Impacto
Una vez aplicado este fix, el sistema de enlaces de compartir permanentes funcionará correctamente, eliminando la necesidad de URLs temporales.
