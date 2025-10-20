# ControlFile Cloudflare Worker - Script de Despliegue (PowerShell)
# Este script automatiza el proceso de configuración y despliegue del Worker

# Configurar para detener en errores
$ErrorActionPreference = "Stop"

# Funciones de logging con colores
function Log-Info {
    param([string]$message)
    Write-Host "ℹ️  $message" -ForegroundColor Blue
}

function Log-Success {
    param([string]$message)
    Write-Host "✅ $message" -ForegroundColor Green
}

function Log-Warning {
    param([string]$message)
    Write-Host "⚠️  $message" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$message)
    Write-Host "❌ $message" -ForegroundColor Red
}

# Banner
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗"
Write-Host "║   ControlFile Cloudflare Worker - Deploy Script           ║"
Write-Host "╚════════════════════════════════════════════════════════════╝"
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "worker.js") -or -not (Test-Path "wrangler.toml")) {
    Log-Error "Este script debe ejecutarse desde el directorio cloudflare/"
    Log-Info "Ejecuta: cd cloudflare; .\deploy.ps1"
    exit 1
}

# Verificar que wrangler esté instalado
try {
    $null = Get-Command wrangler -ErrorAction Stop
    Log-Success "Wrangler CLI encontrado"
} catch {
    Log-Error "Wrangler CLI no está instalado"
    Log-Info "Instálalo con: npm install -g wrangler"
    exit 1
}

# Verificar que el usuario esté autenticado
try {
    wrangler whoami 2>&1 | Out-Null
    Log-Success "Autenticado en Cloudflare"
} catch {
    Log-Warning "No estás autenticado en Cloudflare"
    Log-Info "Iniciando autenticación..."
    wrangler login
}

# Verificar configuración en wrangler.toml
Log-Info "Verificando configuración..."

# Leer valores del wrangler.toml
$content = Get-Content "wrangler.toml" -Raw
if ($content -match 'FIREBASE_PROJECT_ID = "([^"]+)"') {
    $firebaseProjectId = $Matches[1]
    if ($firebaseProjectId -eq "controlstorage-eb796") {
        Log-Success "Firebase Project ID configurado: $firebaseProjectId"
    } else {
        Log-Warning "Firebase Project ID: $firebaseProjectId"
        Log-Warning "Asegúrate de que sea el correcto"
    }
}

if ($content -match 'B2_BUCKET_NAME = "([^"]+)"') {
    $b2BucketName = $Matches[1]
    if ($b2BucketName -eq "your-b2-bucket-name") {
        Log-Error "B2_BUCKET_NAME no está configurado en wrangler.toml"
        Log-Info "Edita cloudflare/wrangler.toml y configura B2_BUCKET_NAME"
        exit 1
    } else {
        Log-Success "B2 Bucket configurado: $b2BucketName"
    }
}

# Preguntar entorno
Write-Host ""
Log-Info "Selecciona el entorno para desplegar:"
Write-Host "  1) development (pruebas)"
Write-Host "  2) staging (pre-producción)"
Write-Host "  3) production (producción)"
Write-Host ""
$envChoice = Read-Host "Selección [1-3]"

switch ($envChoice) {
    "1" { $env = "development" }
    "2" { $env = "staging" }
    "3" { $env = "production" }
    default {
        Log-Error "Selección inválida"
        exit 1
    }
}

Log-Info "Desplegando a: $env"

# Confirmar despliegue
Write-Host ""
Log-Warning "¿Confirmas el despliegue a $env?"
$confirm = Read-Host "Continuar? [y/N]"

if ($confirm -notmatch '^[Yy]$') {
    Log-Info "Despliegue cancelado"
    exit 0
}

# Desplegar
Write-Host ""
Log-Info "Desplegando Worker..."
wrangler deploy --env $env

# Verificar despliegue
if ($LASTEXITCODE -eq 0) {
    Log-Success "Worker desplegado exitosamente!"
    
    # Obtener información del worker
    Write-Host ""
    Log-Info "Obteniendo información del Worker..."
    
    $workerName = "controlfile-shares-$env"
    
    Write-Host ""
    Log-Success "=========================================="
    Log-Success "🎉 Despliegue Completado"
    Log-Success "=========================================="
    Write-Host ""
    Log-Info "Worker: $workerName"
    Log-Info "Entorno: $env"
    Write-Host ""
    Log-Info "Tu Worker está disponible en:"
    Write-Host "  https://$workerName.tu-usuario.workers.dev"
    Write-Host ""
    Log-Info "Para obtener la URL exacta:"
    Write-Host "  wrangler deployments list"
    Write-Host ""
    Log-Info "Ejemplo de uso:"
    Write-Host "  https://$workerName.tu-usuario.workers.dev/image/SHARE_TOKEN"
    Write-Host ""
    Log-Info "Para ver logs en tiempo real:"
    Write-Host "  wrangler tail --env $env"
    Write-Host ""
    
    # Preguntar si quiere ver logs
    $viewLogs = Read-Host "¿Ver logs en tiempo real? [y/N]"
    
    if ($viewLogs -match '^[Yy]$') {
        Log-Info "Mostrando logs (Ctrl+C para salir)..."
        wrangler tail --env $env
    }
    
} else {
    Log-Error "Error al desplegar el Worker"
    exit 1
}

