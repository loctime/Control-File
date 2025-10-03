# 🚀 Guía de Implementación - Fix ControlFile Server

## 📋 Pasos para aplicar el fix:

### 1. **Acceder al servidor de ControlFile**
```bash
# Conectarse al servidor donde está desplegado ControlFile
ssh user@controlfile-server
cd /path/to/controlfile-backend
```

### 2. **Buscar archivos con el problema**
```bash
# Buscar todas las ocurrencias de fileData.uid
grep -r "fileData\.uid" .
grep -r "\.uid !== uid" .
find . -name "*.js" -exec grep -l "fileData\.uid" {} \;
```

### 3. **Aplicar el fix**
En cada archivo encontrado, cambiar:
```javascript
// ❌ Antes:
if (fileData.uid !== uid) {

// ✅ Después:
if (fileData.userId !== uid) {
```

### 4. **Verificar el cambio**
```bash
# Buscar que no queden referencias a fileData.uid
grep -r "fileData\.uid" .
# Debería devolver: "No matches found"
```

### 5. **Reiniciar el servidor**
```bash
# Reiniciar el servicio de ControlFile
pm2 restart controlfile
# o
systemctl restart controlfile
# o según tu configuración de deployment
```

### 6. **Probar el endpoint**
```bash
# Usar el script de prueba
node scripts/test-shares-endpoint.js
```

## 🔍 Archivos típicos a revisar:
- `routes/shares.js`
- `controllers/sharesController.js`
- `middleware/auth.js`
- `utils/fileUtils.js`

## ⚠️ Importante:
- Hacer backup antes de los cambios
- Probar en entorno de desarrollo primero
- Verificar que no se rompan otros endpoints

## 🎯 Resultado esperado:
Después del fix, el endpoint `/api/shares/create` debería devolver:
```json
{
  "shareUrl": "https://files.controldoc.app/share/...",
  "shareToken": "..."
}
```
