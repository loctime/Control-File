# 🐛 Debug del Build Móvil - GitHub Actions

## ❌ **Problema Actual**
El workflow `Build Mobile APK` está fallando sin mostrar logs detallados.

## 🔧 **Soluciones Implementadas**

### **1. Workflow Mejorado con Debug:**
- ✅ Agregados pasos de debug en cada etapa
- ✅ Verificación de archivos de configuración
- ✅ Logs detallados con `--stacktrace --info`
- ✅ Build de debug primero, luego release

### **2. Workflow de Debug Separado:**
- ✅ `mobile-debug.yml` para debugging manual
- ✅ Solo build de debug (más simple)
- ✅ Logs extensivos de cada paso

## 🚀 **Pasos para Resolver**

### **1. Commit los Cambios Mejorados:**
```bash
git add .
git commit -m "fix: improve mobile build workflow with debug logs"
git push origin main
```

### **2. Ejecutar Workflow de Debug:**
1. Ve a GitHub → **Actions**
2. Selecciona **"Debug Mobile Build"**
3. Click **"Run workflow"** → **"Run workflow"**
4. Revisa los logs detallados

### **3. Si el Debug Funciona:**
- El problema está en el build de release
- Probablemente es configuración de firma digital

### **4. Si el Debug Falla:**
- Revisar los logs para identificar el paso específico
- Posibles causas:
  - Archivos de configuración faltantes
  - Android SDK no configurado
  - Dependencias de Capacitor

## 🔍 **Posibles Causas del Fallo**

### **1. Archivos de Configuración:**
```bash
# Verificar que existan:
- next.config.prod.js
- capacitor.config.prod.ts
- android/gradle.properties
```

### **2. Android SDK:**
```bash
# Variables de entorno requeridas:
ANDROID_HOME=/usr/local/lib/android/sdk
ANDROID_SDK_ROOT=/usr/local/lib/android/sdk
```

### **3. Capacitor Sync:**
```bash
# Verificar que el sync funcione:
npx cap sync
```

### **4. Gradle Build:**
```bash
# Verificar que Gradle funcione:
cd android
./gradlew assembleDebug
```

## 📋 **Checklist de Debug**

### **✅ Verificar Localmente:**
```bash
# 1. Probar build local
npm run build:mobile:prod

# 2. Probar Capacitor sync
npx cap sync

# 3. Probar build Android
cd android
./gradlew assembleDebug
```

### **✅ Verificar en GitHub:**
1. **Actions** → **Debug Mobile Build** → **Run workflow**
2. Revisar cada paso en los logs
3. Identificar el paso que falla
4. Aplicar fix específico

## 🛠️ **Fixes Rápidos**

### **Si falla Next.js build:**
```yaml
# Agregar al workflow:
- name: Install additional dependencies
  run: npm install --legacy-peer-deps
```

### **Si falla Android SDK:**
```yaml
# Usar versión específica:
- name: Setup Android SDK
  uses: android-actions/setup-android@v3
  with:
    api-level: 33
    build-tools: 33.0.0
```

### **Si falla Capacitor:**
```yaml
# Agregar step de limpieza:
- name: Clean Capacitor
  run: |
    npx cap clean android
    npx cap sync
```

## 📊 **Logs a Revisar**

### **En GitHub Actions:**
1. **"Debug: Show file structure"** - Verificar archivos
2. **"Setup Android SDK"** - Verificar SDK
3. **"Build Next.js"** - Verificar build web
4. **"Setup Capacitor"** - Verificar sync
5. **"Build APK"** - Verificar build Android

### **Comandos de Debug Local:**
```bash
# Verificar estructura
ls -la android/
ls -la *.js *.ts

# Verificar Capacitor
npx cap doctor

# Verificar Android
cd android && ./gradlew --version
```

## 🎯 **Próximos Pasos**

1. **Commit** los cambios mejorados
2. **Ejecutar** workflow de debug
3. **Revisar** logs detallados
4. **Identificar** problema específico
5. **Aplicar** fix correspondiente
6. **Probar** build completo

## 🆘 **Si Sigue Fallando**

### **Workflow Simplificado:**
```yaml
# Solo build de debug, sin release
- name: Build APK Debug only
  run: |
    cd android
    ./gradlew assembleDebug
```

### **Variables de Entorno:**
```yaml
# Agregar al workflow:
env:
  ANDROID_HOME: /usr/local/lib/android/sdk
  ANDROID_SDK_ROOT: /usr/local/lib/android/sdk
```

**¡Ejecuta el workflow de debug y comparte los logs para identificar el problema específico!** 🔍
