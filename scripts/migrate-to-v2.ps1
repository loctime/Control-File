# Script para migrar endpoints a versión v2
# Uso: .\scripts\migrate-to-v2.ps1

Write-Host "🚀 Migración de endpoints a versión v2" -ForegroundColor Cyan
Write-Host ""

# Función para migrar un archivo
function Migrate-Endpoint {
    param (
        [string]$Path
    )
    
    $v2File = $Path.Replace("route.ts", "route.v2.ts")
    $oldFile = $Path.Replace("route.ts", "route.old.ts")
    
    if (Test-Path $v2File) {
        if (Test-Path $Path) {
            Write-Host "  📦 Respaldando: $Path → route.old.ts" -ForegroundColor Yellow
            Move-Item $Path $oldFile -Force
        }
        
        Write-Host "  ✅ Activando: route.v2.ts → route.ts" -ForegroundColor Green
        Move-Item $v2File $Path -Force
        
        return $true
    }
    
    return $false
}

# Listar endpoints disponibles para migrar
Write-Host "📋 Endpoints disponibles para migrar:" -ForegroundColor Cyan
Write-Host ""

$endpoints = @(
    @{ Name = "1. Uploads - Presign"; Path = "app\api\uploads\presign\route.ts" },
    @{ Name = "2. Uploads - Confirm"; Path = "app\api\uploads\confirm\route.ts" },
    @{ Name = "3. Files - Delete"; Path = "app\api\files\delete\route.ts" },
    @{ Name = "4. Shares - Create"; Path = "app\api\shares\create\route.ts" },
    @{ Name = "5. Folders - Create"; Path = "app\api\folders\create\route.ts" }
)

foreach ($endpoint in $endpoints) {
    $v2Exists = Test-Path $endpoint.Path.Replace("route.ts", "route.v2.ts")
    $status = if ($v2Exists) { "✅ Listo" } else { "⏭️  Sin cambios" }
    Write-Host "  $($endpoint.Name): $status" -ForegroundColor $(if ($v2Exists) { "Green" } else { "Gray" })
}

Write-Host ""
Write-Host "Opciones:" -ForegroundColor Yellow
Write-Host "  1-5: Migrar endpoint específico"
Write-Host "  A: Migrar todos"
Write-Host "  Q: Salir"
Write-Host ""

$choice = Read-Host "Selecciona una opción"

switch ($choice.ToUpper()) {
    "Q" {
        Write-Host "Cancelado" -ForegroundColor Yellow
        exit
    }
    "A" {
        Write-Host ""
        Write-Host "🔄 Migrando todos los endpoints..." -ForegroundColor Cyan
        Write-Host ""
        
        $migrated = 0
        foreach ($endpoint in $endpoints) {
            Write-Host "$($endpoint.Name):" -ForegroundColor Cyan
            if (Migrate-Endpoint -Path $endpoint.Path) {
                $migrated++
            } else {
                Write-Host "  ⏭️  Sin versión v2 disponible" -ForegroundColor Gray
            }
            Write-Host ""
        }
        
        Write-Host "✅ Migración completada: $migrated/$($endpoints.Count) endpoints" -ForegroundColor Green
    }
    {$_ -match '^[1-5]$'} {
        $index = [int]$_ - 1
        $endpoint = $endpoints[$index]
        
        Write-Host ""
        Write-Host "🔄 Migrando: $($endpoint.Name)" -ForegroundColor Cyan
        Write-Host ""
        
        if (Migrate-Endpoint -Path $endpoint.Path) {
            Write-Host ""
            Write-Host "✅ Migración exitosa" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ No hay versión v2 disponible" -ForegroundColor Red
        }
    }
    default {
        Write-Host "Opción inválida" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 Proceso completado" -ForegroundColor Cyan

