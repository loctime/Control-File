# Pasos para Desplegar la Solución de CORS

## 🚨 Problema Actual

El backend en Render aún tiene la configuración antigua de CORS que solo permite `http://localhost:3000`, por eso el frontend en `https://files.controldoc.app` no puede conectarse.

## ✅ Solución Implementada

He actualizado los siguientes archivos:

1. **`backend/src/index.js`** - Nueva configuración de CORS flexible
2. **`backend/env.example`** - Variables de entorno actualizadas
3. **`render.yaml`** - Configuración de despliegue actualizada
4. **`test-cors.js`** - Script de prueba para verificar CORS

## 🚀 Pasos para Desplegar

### Paso 1: Commit y Push de los Cambios

```bash
# Agregar todos los cambios
git add .

# Crear commit con mensaje descriptivo
git commit -m "Fix CORS configuration for production domains

- Update CORS to allow multiple origins
- Add ALLOWED_ORIGINS environment variable
- Include files.controldoc.app and controldoc.app
- Add CORS testing script"

# Subir cambios al repositorio
git push origin main
```

### Paso 2: Verificar Despliegue en Render

1. **Ir al Dashboard de Render**: https://dashboard.render.com
2. **Seleccionar el servicio**: `controlfile-backend`
3. **Verificar el despliegue**: Debería iniciarse automáticamente
4. **Revisar logs**: Buscar el mensaje `🌐 CORS allowed origins:`

### Paso 3: Configurar Variables de Entorno (si es necesario)

Si las variables de entorno no se configuraron automáticamente:

1. En el dashboard de Render, ir a **Environment**
2. Agregar la variable:
   - **Key**: `ALLOWED_ORIGINS`
   - **Value**: `http://localhost:3000,https://files.controldoc.app,https://controldoc.app`

### Paso 4: Probar la Configuración

```bash
# Ejecutar el script de prueba
node test-cors.js
```

**Resultado esperado**:
```
🌐 Origin: https://files.controldoc.app
   Status: 200
   CORS Header: https://files.controldoc.app
   Allowed: ✅
```

### Paso 5: Probar en el Frontend

1. **Abrir**: https://files.controldoc.app
2. **Intentar subir un archivo**
3. **Verificar consola del navegador**: No deberían aparecer errores de CORS

## 🔍 Verificación

### En los Logs de Render

Buscar estos mensajes en los logs del servicio:

```
🌐 CORS allowed origins: [ 'http://localhost:3000', 'https://files.controldoc.app', 'https://controldoc.app' ]
```

### En el Navegador

1. **Abrir DevTools** (F12)
2. **Ir a la pestaña Network**
3. **Intentar subir un archivo**
4. **Verificar que las requests a `/api/uploads/presign` tengan status 200**

## 🚨 Si Algo Sale Mal

### Opción 1: Rollback Rápido

Si necesitas revertir rápidamente:

```bash
# Revertir el último commit
git revert HEAD
git push origin main
```

### Opción 2: Configuración Manual

Si el despliegue automático no funciona:

1. **Ir a Render Dashboard**
2. **Seleccionar el servicio**
3. **Ir a Environment**
4. **Agregar manualmente**:
   ```
   ALLOWED_ORIGINS=http://localhost:3000,https://files.controldoc.app,https://controldoc.app
   ```
5. **Reiniciar el servicio**

### Opción 3: Debugging

Para debugging, puedes temporalmente permitir todos los orígenes:

```javascript
// En backend/src/index.js (temporalmente)
const corsOptions = {
  origin: '*', // ⚠️ SOLO PARA DEBUGGING
  credentials: true,
  optionsSuccessStatus: 200
};
```

## 📞 Soporte

Si tienes problemas:

1. **Revisar logs de Render** para errores específicos
2. **Verificar variables de entorno** están configuradas correctamente
3. **Probar con el script** `test-cors.js` para aislar el problema
4. **Revisar la documentación** en `CORS_SOLUTION.md`

---

**Estado**: ⏳ Pendiente de Despliegue  
**Próximo paso**: Ejecutar `git push origin main`
