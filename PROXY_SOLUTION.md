# Solución al Problema del Proxy de Subida

## 🔍 Problema Identificado

Después de resolver el problema de CORS, apareció un nuevo error:

```
POST https://files.controldoc.app/api/uploads/proxy-upload 500 (Internal Server Error)
```

El problema estaba en la configuración del proxy de subida en el frontend de Next.js.

## ✅ Solución Implementada

### 1. Problema Principal

El archivo `app/api/uploads/proxy-upload/route.ts` estaba usando una variable de entorno incorrecta:

```typescript
// ❌ Incorrecto
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

// ✅ Correcto
const backendUrl = 'https://controlfile.onrender.com';
```

### 2. Cambios Realizados

**Archivo**: `app/api/uploads/proxy-upload/route.ts`

```typescript
export async function POST(request: NextRequest) {
  try {
    console.log('📤 Next.js proxy upload endpoint called');
    
    // Redirigir la petición al backend
    const backendUrl = 'https://controlfile.onrender.com';
    console.log('📤 Backend URL:', backendUrl);
    
    const formData = await request.formData();
    console.log('📤 FormData received:', formData);
    
    const backendResponse = await fetch(`${backendUrl}/api/uploads/proxy-upload`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
      body: formData,
    });

    const responseData = await backendResponse.json();
    
    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: responseData.error || 'Error en el servidor backend' },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in proxy upload:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

### 3. Mejoras Implementadas

1. **URL del backend hardcodeada**: Para evitar problemas con variables de entorno
2. **Logging mejorado**: Para debugging del proxy
3. **Manejo de FormData**: Procesamiento correcto de los datos del formulario

## 🚀 Flujo de Subida

### 1. Frontend → Proxy (Next.js)
```
POST /api/uploads/proxy-upload
Content-Type: multipart/form-data
Authorization: Bearer <token>
Body: FormData con archivo y sessionId
```

### 2. Proxy → Backend (Render)
```
POST https://controlfile.onrender.com/api/uploads/proxy-upload
Content-Type: multipart/form-data
Authorization: Bearer <token>
Body: FormData con archivo y sessionId
```

### 3. Backend → B2
```
PUT https://s3.us-east-005.backblazeb2.com/...
Body: Contenido del archivo
```

## 🔧 Verificación

### Script de Prueba

**Archivo**: `test-proxy.js`
- Prueba el endpoint del proxy directamente
- Verifica que la comunicación entre frontend y backend funciona
- Incluye manejo de errores y limpieza de archivos

### Logs Esperados

En el frontend (Next.js):
```
📤 Next.js proxy upload endpoint called
📤 Backend URL: https://controlfile.onrender.com
📤 FormData received: [FormData object]
```

En el backend (Render):
```
📤 Proxy upload request received
📤 File info: [file object]
📤 Session ID: [session id]
```

## 📝 Notas Importantes

1. **Variables de Entorno**: El proxy ahora usa la URL del backend directamente para evitar problemas de configuración

2. **FormData**: El proxy maneja correctamente los datos del formulario multipart

3. **Autenticación**: El token de autorización se pasa correctamente del frontend al backend

4. **Error Handling**: Mejor manejo de errores con logging detallado

## 🧪 Testing

Para probar que la solución funciona:

1. **En el navegador**: Intentar subir un archivo desde `https://files.controldoc.app`
2. **En la consola**: Verificar que no aparezcan errores 500
3. **En los logs**: Confirmar que el proxy procesa correctamente la solicitud

## 🔄 Rollback

Si algo sale mal, se puede revertir fácilmente:

1. Cambiar la URL del backend de vuelta a una variable de entorno
2. O comentar temporalmente el proxy para debugging

---

**Estado**: ✅ Implementado  
**Fecha**: $(date)  
**Responsable**: AI Assistant
