#!/bin/bash

# ControlFile Cloudflare Worker - Script de Despliegue
# Este script automatiza el proceso de configuración y despliegue del Worker

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de logging
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Banner
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   ControlFile Cloudflare Worker - Deploy Script           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "worker.js" ] || [ ! -f "wrangler.toml" ]; then
    log_error "Este script debe ejecutarse desde el directorio cloudflare/"
    log_info "Ejecuta: cd cloudflare && ./deploy.sh"
    exit 1
fi

# Verificar que wrangler esté instalado
if ! command -v wrangler &> /dev/null; then
    log_error "Wrangler CLI no está instalado"
    log_info "Instálalo con: npm install -g wrangler"
    exit 1
fi

log_success "Wrangler CLI encontrado"

# Verificar que el usuario esté autenticado
if ! wrangler whoami &> /dev/null; then
    log_warning "No estás autenticado en Cloudflare"
    log_info "Iniciando autenticación..."
    wrangler login
fi

log_success "Autenticado en Cloudflare"

# Verificar configuración en wrangler.toml
log_info "Verificando configuración..."

# Leer valores del wrangler.toml
FIREBASE_PROJECT_ID=$(grep "FIREBASE_PROJECT_ID" wrangler.toml | head -1 | cut -d'"' -f2)
B2_BUCKET_NAME=$(grep "B2_BUCKET_NAME" wrangler.toml | head -1 | cut -d'"' -f2)

if [ "$FIREBASE_PROJECT_ID" == "controlstorage-eb796" ]; then
    log_success "Firebase Project ID configurado: $FIREBASE_PROJECT_ID"
else
    log_warning "Firebase Project ID: $FIREBASE_PROJECT_ID"
    log_warning "Asegúrate de que sea el correcto"
fi

if [ "$B2_BUCKET_NAME" == "your-b2-bucket-name" ]; then
    log_error "B2_BUCKET_NAME no está configurado en wrangler.toml"
    log_info "Edita cloudflare/wrangler.toml y configura B2_BUCKET_NAME"
    exit 1
else
    log_success "B2 Bucket configurado: $B2_BUCKET_NAME"
fi

# Preguntar entorno
echo ""
log_info "Selecciona el entorno para desplegar:"
echo "  1) development (pruebas)"
echo "  2) staging (pre-producción)"
echo "  3) production (producción)"
echo ""
read -p "Selección [1-3]: " env_choice

case $env_choice in
    1)
        ENV="development"
        ;;
    2)
        ENV="staging"
        ;;
    3)
        ENV="production"
        ;;
    *)
        log_error "Selección inválida"
        exit 1
        ;;
esac

log_info "Desplegando a: $ENV"

# Confirmar despliegue
echo ""
log_warning "¿Confirmas el despliegue a $ENV?"
read -p "Continuar? [y/N]: " confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
    log_info "Despliegue cancelado"
    exit 0
fi

# Desplegar
echo ""
log_info "Desplegando Worker..."
wrangler deploy --env "$ENV"

# Verificar despliegue
if [ $? -eq 0 ]; then
    log_success "Worker desplegado exitosamente!"
    
    # Obtener URL del worker
    echo ""
    log_info "Obteniendo información del Worker..."
    
    WORKER_NAME="controlfile-shares-$ENV"
    
    echo ""
    log_success "=========================================="
    log_success "🎉 Despliegue Completado"
    log_success "=========================================="
    echo ""
    log_info "Worker: $WORKER_NAME"
    log_info "Entorno: $ENV"
    echo ""
    log_info "Tu Worker está disponible en:"
    echo "  https://$WORKER_NAME.tu-usuario.workers.dev"
    echo ""
    log_info "Para obtener la URL exacta:"
    echo "  wrangler deployments list"
    echo ""
    log_info "Ejemplo de uso:"
    echo "  https://$WORKER_NAME.tu-usuario.workers.dev/image/SHARE_TOKEN"
    echo ""
    log_info "Para ver logs en tiempo real:"
    echo "  wrangler tail --env $ENV"
    echo ""
    
    # Preguntar si quiere ver logs
    read -p "¿Ver logs en tiempo real? [y/N]: " view_logs
    
    if [[ $view_logs =~ ^[Yy]$ ]]; then
        log_info "Mostrando logs (Ctrl+C para salir)..."
        wrangler tail --env "$ENV"
    fi
    
else
    log_error "Error al desplegar el Worker"
    exit 1
fi

