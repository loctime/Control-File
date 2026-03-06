# LOGISTICS V2 Backend Implementation Plan

Este documento resume el plan ejecutado para implementar Logística V2 en `controlfile`.

## Estado
- Implementación base creada en `backend/src/modules/logistics`.
- Endpoints write/read montados bajo `/api/logistics/v2`.
- Infra común implementada: correlationId, ApiError, authz owner/branch, helper transaccional, idempotencia, counters, audit y storage/document_files.

## Endpoints
- POST `/api/logistics/v2/pedidos-internos`
- POST `/api/logistics/v2/remitos-salida/emitir`
- POST `/api/logistics/v2/recepciones/confirmar`
- POST `/api/logistics/v2/devoluciones/crear`
- GET `/api/logistics/v2/remitos/:id`
- GET `/api/logistics/v2/recepciones/:id`
- GET `/api/logistics/v2/devoluciones/:id`
- GET `/api/logistics/v2/documentos`

## Decisiones aplicadas
- Storage binario: Backblaze B2.
- Metadata de archivos: `apps/horarios/document_files`.
- Authorization owner/branch: `apps/horarios/users`.
- Catálogo y stock: `apps/horarios/products` + `apps/horarios/stock_actual`.
- Runtime: JavaScript CommonJS.

## Testing
- Unit tests de validadores y hashing de idempotencia.
- Integration test base (skipped) para flujo completo.

## Pendientes recomendados
- Endurecer reglas de stock/pack según reglas de negocio finales.
- Implementar generación real de PDF y vinculación automática de `pdfFileId`.
- Agregar índices Firestore específicos para filtros de `/documentos` en producción.
