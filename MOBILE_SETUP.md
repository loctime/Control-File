# ControlFile - Configuración Móvil con Capacitor

## ✅ Estado Actual

Capacitor está configurado y listo para desarrollo móvil:

### Configuración Completada:
- ✅ Capacitor instalado y configurado
- ✅ Plataforma Android agregada
- ✅ Plugins esenciales instalados (Camera, Filesystem, Share, etc.)
- ✅ Scripts de build configurados
- ✅ Configuración para desarrollo local

### Archivos Configurados:
- `capacitor.config.ts` - Configuración principal
- `package.json` - Scripts de build móvil
- `android/` - Proyecto Android generado

## 🚀 Comandos Disponibles

### Desarrollo:
```bash
# Desarrollo móvil (Next.js + Android)
npm run dev:mobile

# Solo sincronizar cambios
npm run build:mobile
```

### Build y Deploy:
```bash
# Abrir Android Studio
npm run android:open

# Build completo para Android
npm run android:build
```

## 📱 Configuración de la App

### Detalles de la App:
- **Nombre**: ControlFile
- **ID**: `app.controlfile.files.controldoc.app`
- **Dominio**: files.controldoc.app

### Plugins Instalados:
- 📷 Camera - Para capturar fotos
- 📁 Filesystem - Acceso a archivos locales
- 🔗 Share - Compartir archivos
- 📱 Device - Información del dispositivo
- 🌐 Network - Estado de conexión
- 🎨 Splash Screen - Pantalla de carga
- 📊 Status Bar - Barra de estado

## 🔧 Próximos Pasos

### Para Desarrollar:
1. Ejecutar `npm run dev:frontend` en una terminal
2. Ejecutar `npm run android:open` en otra terminal
3. La app se abrirá en Android Studio/emulador

### Para Producción:
1. Configurar variables de entorno para producción
2. Ejecutar `npm run android:build`
3. Firmar y publicar APK

## 📝 Notas Importantes

- La app usa el servidor de desarrollo local (YOUR_LOCAL_IP:3000)
- Todas las APIs están disponibles para la app móvil
- Firebase Auth funciona igual que en web
- Backblaze B2 integrado para almacenamiento

## 🛠️ Solución de Problemas

### Si la app no carga:
1. Verificar que Next.js esté corriendo en puerto 3000
2. Verificar configuración de red en emulador
3. Revisar logs en Android Studio

### Si hay errores de build:
1. Limpiar cache: `npx cap clean android`
2. Re-sincronizar: `npm run build:mobile`
