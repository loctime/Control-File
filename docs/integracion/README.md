# 📚 Documentación de Integración con Apps Externas

Esta carpeta contiene toda la documentación necesaria para integrar aplicaciones externas con ControlFile, permitiéndoles usar el sistema de almacenamiento como reemplazo de Firebase Storage.

## 📖 Guías Disponibles

### 🎯 Para Diferentes Audiencias

| Documento | Audiencia | Descripción | Tiempo de lectura |
|-----------|-----------|-------------|-------------------|
| **[RESUMEN_EJECUTIVO_INTEGRACION.md](./RESUMEN_EJECUTIVO_INTEGRACION.md)** | 👔 Gerentes/CTOs | Respuesta ejecutiva a la pregunta de integración, comparación de opciones | 5 min |
| **[README_INTEGRACION_RAPIDA.md](./README_INTEGRACION_RAPIDA.md)** ⭐ | 👨‍💻 Programadores | Guía práctica paso a paso con código listo para usar | 10 min + implementación |
| **[GUIA_CONSUMIR_SHARE_LINKS.md](./GUIA_CONSUMIR_SHARE_LINKS.md)** 🔗 | 👨‍💻 Programadores | Cómo descargar archivos compartidos desde share links públicos (sin auth) | 10 min |
| **[MIGRACION_USUARIOS.md](./MIGRACION_USUARIOS.md)** 🔄 | 👨‍💻 DevOps/Admins | Guía completa para migrar usuarios existentes al Auth Central | 15 min + migración |
| **[GUIA_BACKEND.md](./GUIA_BACKEND.md)** 🗂️ | 👨‍💻 Backend Devs | Creación de carpetas y estructura desde backend (ej: ControlGastos) | 20 min + implementación |
| **[CHECKLIST_ADMIN_INTEGRACION.md](./CHECKLIST_ADMIN_INTEGRACION.md)** | 🔧 Admins Backend | Checklist de configuración del backend y asignación de accesos | 15 min |
| **[GUIA_INTEGRACION_APPS_EXTERNAS.md](./GUIA_INTEGRACION_APPS_EXTERNAS.md)** | 🏗️ Arquitectos | Documentación técnica completa con ambos escenarios de integración | 30 min |

## 🚀 Inicio Rápido

### Si eres el coordinador de la integración:
1. Lee el **RESUMEN_EJECUTIVO_INTEGRACION.md** (5 min)
2. Decide qué escenario usar (Escenario 1 recomendado en el 95% de los casos)
3. **Planea la migración de usuarios** → Ver **MIGRACION_USUARIOS.md** 🔄
4. Entrega **README_INTEGRACION_RAPIDA.md** al equipo de desarrollo
5. Entrega **CHECKLIST_ADMIN_INTEGRACION.md** al administrador del backend

### Si eres programador de la app externa:
1. Ve directo a **README_INTEGRACION_RAPIDA.md** ⭐
2. Sigue los 5 pasos de instalación
3. Copia y pega el código
4. ¡Listo! Tienes storage funcionando

### Si necesitas descargar archivos desde share links públicos (sin autenticación):
1. Lee **GUIA_CONSUMIR_SHARE_LINKS.md** 🔗
2. Copia la clase `ControlFileShareClient`
3. Usa `getShareInfo()` y `downloadFile()`
4. Caso de uso típico: Bolsa de Trabajo, compartir CVs, fotos públicas

### Si desarrollas backend y necesitas crear carpetas automáticamente:
1. Lee **GUIA_BACKEND.md** 🗂️
2. Implementa `getUserFolderStructure()`
3. Usa ejemplos de ControlGastos
4. Guarda referencias en tu Firestore

### Si eres administrador del backend:
1. Lee **CHECKLIST_ADMIN_INTEGRACION.md**
2. Sigue la lista de verificación paso a paso
3. Usa los scripts proporcionados para configurar usuarios
4. Verifica la integración con el script de prueba

### Si necesitas entender la arquitectura completa:
1. Lee **GUIA_INTEGRACION_APPS_EXTERNAS.md**
2. Revisa los diagramas de arquitectura
3. Compara Escenario 1 vs Escenario 2
4. Toma una decisión informada

## 🔍 Resumen de Escenarios

### Escenario 1: Firebase Auth Compartido ⭐ RECOMENDADO

```
App Externa → Firebase Auth Central → Backend ControlFile → Backblaze B2
                (compartido)
```

**Ventajas:**
- ✅ Simple y rápido (5 min setup)
- ✅ Sin código adicional
- ✅ SSO entre apps
- ✅ Bajo costo

**Qué se comparte:**
- Firebase Auth (usuarios)
- Backend ControlFile (API)
- Almacenamiento B2

**Qué NO se comparte:**
- Firestore de datos (cada app tiene el suyo)
- Frontend
- Lógica de negocio

### Escenario 2: Firebase Auth Separado ⚠️ AVANZADO

```
App Externa → Tu Firebase Auth → Proxy Auth → ControlFile Auth → Backend → B2
```

**Solo usar si:**
- Restricciones de compliance
- Imposible migrar usuarios
- Requisitos de negocio específicos

**Desventajas:**
- ⚠️ Alta complejidad
- ⚠️ Latencia adicional
- ⚠️ Costos de infraestructura extra
- ⚠️ Más puntos de fallo

## 📦 Funcionalidades Disponibles

La integración proporciona acceso completo a:

- ✅ **Subida de archivos** (con proxy para evitar CORS)
- ✅ **Descarga de archivos** (URLs temporales)
- ✅ **Listado de archivos y carpetas**
- ✅ **Eliminación de archivos**
- ✅ **Compartir archivos** (enlaces públicos con expiración)
- ✅ **Creación de carpetas**
- ✅ **Sistema de cuotas por usuario**
- ✅ **Gestión de versiones** (reemplazar archivos)
- ✅ **Búsqueda y filtrado**

## 🛠️ Tecnologías Utilizadas

- **Autenticación**: Firebase Auth (JWT tokens)
- **Backend**: Node.js/Express (ya desplegado)
- **Storage**: Backblaze B2 (S3-compatible)
- **Base de datos**: Firestore (metadata de archivos)
- **Proxy**: Sistema de upload sin CORS
- **CDN**: Cloudflare Workers (opcional)

## 📊 Comparación Rápida

| Característica | Escenario 1 | Escenario 2 |
|----------------|-------------|-------------|
| Tiempo de implementación | 5 minutos | 2-5 días |
| Complejidad | ⭐ Baja | ⭐⭐⭐⭐ Alta |
| Mantenimiento | ⭐⭐⭐⭐⭐ Fácil | ⭐⭐ Difícil |
| Latencia | ⭐⭐⭐⭐⭐ Baja | ⭐⭐ Media |
| Costos adicionales | $0 | $5-20/mes |
| SSO | ✅ Sí | ❌ No |
| Proyectos Firebase | 1 compartido | 2 separados |

## 🎓 Ejemplos de Código

### Upload básico

```typescript
import { uploadFile } from '@/lib/storage';

const fileId = await uploadFile(file, null, (progress) => {
  console.log(`Subiendo: ${progress}%`);
});

console.log('Archivo subido:', fileId);
```

### Download

```typescript
import { getDownloadUrl } from '@/lib/storage';

const url = await getDownloadUrl(fileId);
window.open(url, '_blank'); // Válido por 5 minutos
```

### Compartir

```typescript
import { shareFile } from '@/lib/storage';

const shareUrl = await shareFile(fileId, 24); // 24 horas
navigator.clipboard.writeText(shareUrl);
```

Ver ejemplos completos en **README_INTEGRACION_RAPIDA.md**.

## 🔐 Seguridad

- **Autenticación**: JWT tokens de Firebase
- **Autorización**: Claims personalizados por app
- **Aislamiento**: Archivos separados por usuario (no por app)
- **URLs temporales**: Expiración en 5 minutos
- **CORS**: Configurado por dominio
- **Validación**: En cada request del backend

## 📞 Soporte

**Documentación adicional:**
- [API_REFERENCE.md](../../API_REFERENCE.md) - Referencia completa de endpoints
- [API_INTEGRATION.md](../../API_INTEGRATION.md) - Guía técnica de integración original

**Contacto:**
- Email: soporte@controldoc.app
- Issues: GitHub del proyecto

## 🗺️ Roadmap de Integración

### Fase 0: Planificación (1-2 horas)
- [ ] Leer documentación
- [ ] Decidir escenario (Auth compartido recomendado)
- [ ] Planear migración de usuarios
- [ ] Obtener credenciales del Auth Central

### Fase 1: Migración de Usuarios (15-30 min) 🔄
- [ ] Exportar usuarios del proyecto actual
- [ ] Importar al Auth Central de ControlFile
- [ ] Asignar claims (`allowedApps`)
- [ ] Probar login con usuarios de prueba
- [ ] Ver **MIGRACION_USUARIOS.md** para detalles

### Fase 2: Implementación (1-2 días)
- [ ] Configurar Firebase Auth Central en app
- [ ] Implementar cliente de ControlFile
- [ ] Crear componentes de UI
- [ ] Configurar CORS en backend

### Fase 3: Testing (1 día)
- [ ] Probar login con usuarios migrados
- [ ] Probar upload/download
- [ ] Probar compartir archivos
- [ ] Verificar cuotas

### Fase 4: Producción
- [ ] Desplegar a producción
- [ ] Monitorear errores de login
- [ ] Monitorear uso de ControlFile
- [ ] Recolectar feedback

## ✅ Checklist Rápido

### Para el coordinador/DevOps:
- [ ] **Migrar usuarios** (ver MIGRACION_USUARIOS.md) 🔄
  - [ ] Exportar usuarios del proyecto actual
  - [ ] Importar al Auth Central
  - [ ] Verificar importación exitosa
- [ ] Coordinar con admin de ControlFile para claims
- [ ] Obtener credenciales del Auth Central

### Para el equipo de desarrollo:
- [ ] Instalar `firebase` package
- [ ] Configurar Firebase Auth Central (no el antiguo)
- [ ] Copiar cliente de ControlFile
- [ ] Implementar componentes de upload/download
- [ ] Probar login con usuarios migrados
- [ ] Probar en desarrollo
- [ ] Desplegar a producción

### Para el administrador de ControlFile:
- [ ] Proporcionar credenciales del Auth Central
- [ ] Configurar `ALLOWED_ORIGINS` en backend
- [ ] Asignar claims (`allowedApps`) a usuarios
- [ ] Verificar cuotas
- [ ] Monitorear logs

### Para todos:
- [ ] Leer la documentación relevante
- [ ] Entender el flujo de autenticación
- [ ] Conocer las limitaciones
- [ ] Tener plan de soporte

## 📝 Historial de Versiones

- **v1.0.0** (Octubre 2025) - Documentación inicial completa
  - Escenario 1: Firebase Auth Compartido
  - Escenario 2: Firebase Auth Separado
  - Guías para todas las audiencias
  - Scripts de verificación

## 🎯 Casos de Uso Comunes

### 1. App de Facturación
```
- Usuarios se autentican con Firebase Auth Central
- Facturas (datos) en Firestore propio
- PDFs de facturas en ControlFile
- Compartir facturas con clientes vía link público
```

### 2. App de Recursos Humanos
```
- Empleados se autentican con Auth Central
- Datos de empleados en Firestore propio
- Documentos (contratos, CV) en ControlFile
- Descarga segura de documentos
```

### 3. App de Gestión de Proyectos
```
- Equipo se autentica con Auth Central
- Tareas/proyectos en Firestore propio
- Archivos adjuntos en ControlFile
- Compartir archivos entre miembros del equipo
```

---

**¿Por dónde empezar?**

1. 👔 **Ejecutivo/Gerente** → Lee [RESUMEN_EJECUTIVO_INTEGRACION.md](./RESUMEN_EJECUTIVO_INTEGRACION.md)
2. 🔄 **DevOps/Admin** → Lee [MIGRACION_USUARIOS.md](./MIGRACION_USUARIOS.md) - ¡Hazlo primero!
3. 👨‍💻 **Programador Frontend** → Lee [README_INTEGRACION_RAPIDA.md](./README_INTEGRACION_RAPIDA.md) ⭐
4. 👨‍💻 **Programador Backend** → Lee [GUIA_BACKEND.md](./GUIA_BACKEND.md) 🗂️
5. 🔧 **Admin Backend ControlFile** → Lee [CHECKLIST_ADMIN_INTEGRACION.md](./CHECKLIST_ADMIN_INTEGRACION.md)
6. 🏗️ **Arquitecto** → Lee [GUIA_INTEGRACION_APPS_EXTERNAS.md](./GUIA_INTEGRACION_APPS_EXTERNAS.md)

**Orden recomendado de implementación:**
1. Migración de usuarios (15-30 min)
2. Configuración del backend (15 min)
3. Implementación en la app (1-2 días)
4. Deploy y monitoreo

**¡Buena suerte con tu integración!** 🚀

