# API de Emails - Documentación de Integración Frontend

## 1. Arquitectura del sistema

### 1.1 Componentes backend analizados
- `backend/src/routes/email-receptor.js`
- `backend/src/routes/emailAlerts.js`
- `backend/src/routes/emailWebhook.js`
- `backend/src/modules/emailUsers/*`
- `backend/src/modules/emailAlerts/*`
- `backend/src/services/vehicleEventService.js`
- `backend/src/services/vehicleEventParser.js`
- `backend/src/services/dailyMetricsService.js`
- `backend/src/routes/admin.js` (secciones email/vehicle alerts)
- `backend/src/middleware/auth.js`

Nota: `backend/src/lib/` no contiene archivos en este proyecto.

### 1.2 Capas funcionales
- Ingesta de emails:
  - `POST /api/email-local-ingest` (ingesta operativa local).
  - `POST /api/email-inbound` (webhook inbound, actualmente sin persistencia final).
- Procesamiento:
  - Parseo de eventos de vehículo por tipo de correo (`excesos`, `no_identificados`, `contacto`).
  - Dedupe por `eventId` determinístico.
- Persistencia Firestore:
  - `inbox`, `vehicleEvents`, `vehicles`, `dailyAlerts`, `meta`, índice `responsables`.
- Exposición para frontend:
  - API autenticada con Bearer para usuario final y panel.
- Exposición para scripts/automatización:
  - API con `x-local-token` para obtener pendientes y marcar envío.

## 2. Endpoints disponibles

### 2.1 Ingesta y procesamiento

#### `POST /api/email-local-ingest`
- Propósito:
  - Ingerir emails desde fuente local (`outlook-local`), parsear eventos, persistir inbox/eventos y actualizar `vehicles` + `dailyAlerts`.
- Quién lo usa:
  - Script local / automatización local.
- Autenticación requerida:
  - Header `x-local-token: <LOCAL_EMAIL_TOKEN>`.
- Body esperado:
```json
{
  "source": "outlook-local",
  "email": {
    "message_id": "optional-id",
    "from": "alerta@dominio.com",
    "to": ["destino@dominio.com"],
    "subject": "Excesos del dia",
    "body_text": "...",
    "body_html": "<html>...</html>",
    "received_at": "2026-03-05T10:30:00-03:00",
    "attachments": []
  }
}
```
- Respuesta:
```json
{
  "ok": true,
  "message_id": "abc",
  "ingested_at": "2026-03-05T13:30:00.000Z",
  "vehicle_events": 12,
  "vehicle_events_created": 10,
  "vehicle_events_skipped": 2,
  "vehicles_updated": 4,
  "daily_alerts_updated": 4
}
```
- Campos:
  - `vehicle_events`: eventos parseados.
  - `vehicle_events_created`: nuevos en `vehicleEvents`.
  - `vehicle_events_skipped`: eventos sin vehículo registrado (o no procesables).

#### `POST /api/email-inbound`
- Propósito:
  - Recibir webhook inbound (Resend), consultar contenido real del email y loguearlo.
- Quién lo usa:
  - Integración webhook externa.
- Autenticación requerida:
  - Ninguna (actualmente).
- Entrada:
  - Payload tipo `email.received` con `data.email_id`.
- Respuesta:
  - Siempre `200 OK` con texto `"OK"`.
- Observación:
  - En el código hay `TODO` de persistencia (flujo incompleto para producción).

### 2.2 Alertas diarias (scripts/cron)

#### `GET /api/email/get-pending-daily-alerts`
- Propósito:
  - Obtener alertas pendientes (días anteriores al actual en zona `America/Argentina/Buenos_Aires`) consolidadas por conjunto de responsables.
- Quién lo usa:
  - Script local / automatización (ejemplo real: `send-alerts.ps1`).
- Autenticación requerida:
  - Header `x-local-token`.
- Query:
  - Sin query obligatoria.
- Respuesta:
```json
{
  "ok": true,
  "general": {
    "subject": "Resumen general de operaciones - 2026-03-04",
    "body": "<html>...</html>"
  },
  "alerts": [
    {
      "responsableEmails": ["a@x.com", "b@x.com"],
      "responsableEmail": "a@x.com",
      "subject": "Resumen diario de flota - 2026-03-04",
      "body": "<html>...</html>",
      "alertIds": ["2026-03-04_AF999EF"]
    }
  ]
}
```
- Campos:
  - `alerts[].responsableEmails`: destinatarios del grupo.
  - `alerts[].responsableEmail`: compatibilidad legacy.
  - `alerts[].alertIds`: IDs para confirmar envío.

#### `POST /api/email/mark-alert-sent`
- Propósito:
  - Marcar una o varias alertas como enviadas y propagar estado al índice por responsable.
- Quién lo usa:
  - Script local / automatización.
- Autenticación requerida:
  - Header `x-local-token`.
- Body:
```json
{
  "alertIds": ["2026-03-04_AF999EF", "2026-03-04_AB123CD"]
}
```
  - Compatibilidad: también acepta `{ "alertId": "2026-03-04_AF999EF" }`.
- Respuesta:
```json
{
  "ok": true,
  "alertIds": ["2026-03-04_AF999EF"],
  "marked": 1
}
```

#### `GET /api/email/daily-metrics?date=YYYY-MM-DD`
- Propósito:
  - Métricas agregadas de un día.
- Quién lo usa:
  - Script, dashboard técnico, debug.
- Autenticación requerida:
  - Header `x-local-token`.
- Respuesta:
```json
{
  "ok": true,
  "dateKey": "2026-03-04",
  "metrics": {
    "excesos": 10,
    "no_identificados": 2,
    "contactos": 1,
    "llave_sin_cargar": 1,
    "conductor_inactivo": 0,
    "totalVehicles": 6,
    "totalEvents": 14,
    "totalCriticos": 14,
    "totalAdvertencias": 0,
    "totalAdministrativos": 0,
    "vehiclesWithCritical": 6,
    "lastUpdatedAt": null
  }
}
```

#### `GET /api/email/daily-consistency?date=YYYY-MM-DD`
- Propósito:
  - Validación de consistencia entre `meta.totalEvents` y suma real de `events` por vehículo.
- Quién lo usa:
  - Debug / operación técnica.
- Autenticación requerida:
  - Header `x-local-token`.
- Respuesta:
```json
{
  "ok": true,
  "dateKey": "2026-03-04",
  "totalInMeta": 14,
  "totalInAlerts": 14,
  "diff": 0
}
```

#### `GET /api/email/debug-pending-alerts`
- Propósito:
  - Diagnóstico interno del estado de pendientes.
- Quién lo usa:
  - Debug interno.
- Autenticación requerida:
  - Header `x-local-token`.

### 2.3 API de usuario para frontend (panel)

#### `POST /api/email/ensure-user`
- Clasificación:
  - Endpoint operativo interno (alta/sync de acceso), no para consumo normal del frontend cliente.
- Autenticación:
  - `x-local-token`.
- Body:
```json
{
  "email": "user@dominio.com",
  "role": "responsable"
}
```
- `role` válido: `admin | general | report | responsable`.

#### `GET /api/email/me`  `FRONTEND_API`
- Propósito:
  - Validar usuario autenticado y devolver rol habilitado para módulo de emails.
- Autenticación:
  - `Authorization: Bearer <firebase-id-token>`.
- Respuesta:
```json
{
  "ok": true,
  "email": "user@dominio.com",
  "role": "responsable"
}
```

#### `GET /api/email/my-vehicles`  `FRONTEND_API`
- Propósito:
  - Listar vehículos visibles según rol.
- Autenticación:
  - Bearer.
- Respuesta:
```json
{
  "ok": true,
  "vehicles": [
    {
      "id": "AF999EF",
      "plate": "AF999EF",
      "brand": "FORD",
      "model": "RANGER",
      "responsables": ["r@dominio.com"],
      "responsablesNormalized": ["r@dominio.com"],
      "operationName": "OPERACION X"
    }
  ]
}
```

#### `GET /api/vehicles/my-vehicles`  `FRONTEND_API`
- Propósito:
  - Alias explícito de `/api/email/my-vehicles` (misma lógica y respuesta).

#### `GET /api/email/my-alerts`  `FRONTEND_API`
- Propósito:
  - Paginación de alertas del usuario desde índice `responsables/{email}/alerts`.
- Autenticación:
  - Bearer.
- Query:
  - `limit` (default 50, max 200).
  - `startAfter` (alertId anterior, ej. `2026-03-04_AF999EF`).
- Respuesta:
```json
{
  "ok": true,
  "alerts": [
    {
      "plate": "AF999EF",
      "dateKey": "2026-03-04",
      "riskScore": 3,
      "alertSent": false
    }
  ]
}
```

#### `GET /api/email/my-alerts-vehicles`  `FRONTEND_API`
- Propósito:
  - Vehículos del responsable enriquecidos con riesgo máximo y última fecha de alerta.
- Autenticación:
  - Bearer.
- Respuesta:
```json
{
  "ok": true,
  "vehicles": [
    {
      "plate": "AF999EF",
      "operationName": "OPERACION X",
      "lastEvent": "2026-03-04",
      "riskScore": 5
    }
  ]
}
```

#### `GET /api/email/my-stats`  `FRONTEND_API`
- Propósito:
  - KPIs agregados del usuario.
- Autenticación:
  - Bearer.
- Respuesta:
```json
{
  "ok": true,
  "stats": {
    "totalAlerts": 30,
    "alertsToday": 2,
    "alertsPending": 10,
    "alertsSent": 20,
    "maxRisk": 7,
    "avgRisk": 2.4
  }
}
```

#### `GET /api/email/my-risk`  `FRONTEND_API`
- Propósito:
  - Riesgo por patente.
- Autenticación:
  - Bearer.
- Respuesta:
```json
{
  "ok": true,
  "vehicles": [
    {
      "plate": "AF999EF",
      "alerts": 8,
      "maxRisk": 7
    }
  ]
}
```

### 2.4 Endpoints admin relacionados con emails

Todos bajo `/api/admin/*` y montados con `authMiddleware` + validación adicional `req.claims.role in ['admin','supermax']`.

#### `PATCH /api/admin/vehicle-alerts`  `FRONTEND_API` (panel admin)
- Propósito:
  - Actualizar responsables por vehículo y sincronizar accesos.
- Body:
```json
{
  "vehicles": [
    { "plate": "AF999EF", "responsables": ["r@dominio.com"] }
  ]
}
```
- Respuesta:
```json
{
  "ok": true,
  "vehiclesUpdated": 1,
  "sync": { "created": 0, "updated": 1, "disabled": 0, "totalEmails": 5 }
}
```

#### `GET /api/admin/email-config`  `FRONTEND_API` (panel admin)
- Propósito:
  - Leer destinatarios globales de alertas.
- Respuesta:
```json
{
  "ok": true,
  "config": {
    "generalRecipients": [],
    "ccRecipients": [],
    "reportRecipients": []
  }
}
```

#### `PATCH /api/admin/email-config`  `FRONTEND_API` (panel admin)
- Propósito:
  - Actualizar `generalRecipients`, `ccRecipients`, `reportRecipients` y sincronizar accesos.
- Body:
```json
{
  "generalRecipients": ["general@dominio.com"],
  "ccRecipients": ["cc@dominio.com"],
  "reportRecipients": ["reporte@dominio.com"]
}
```

#### `POST /api/admin/sync-access-users`  ADMIN/OPERACIÓN
- Propósito:
  - Recalcular `apps/emails/access` desde `vehicles` + `config`.

### 2.5 Endpoint explícitamente no frontend

#### `POST /api/admin/create-user`
- El propio código lo marca como IAM/Core y "NO LLAMAR DESDE FRONTEND".

## 3. Endpoints para frontend

### 3.1 Lista recomendada para integración frontend
- `GET /api/email/me`
- `GET /api/email/my-vehicles`
- `GET /api/vehicles/my-vehicles` (alias)
- `GET /api/email/my-alerts`
- `GET /api/email/my-alerts-vehicles`
- `GET /api/email/my-stats`
- `GET /api/email/my-risk`
- `GET /api/admin/email-config` (solo panel admin)
- `PATCH /api/admin/email-config` (solo panel admin)
- `PATCH /api/admin/vehicle-alerts` (solo panel admin)

### 3.2 No usar desde frontend cliente
- `POST /api/email-local-ingest`
- `POST /api/email-inbound`
- `GET /api/email/get-pending-daily-alerts`
- `POST /api/email/mark-alert-sent`
- `GET /api/email/daily-metrics`
- `GET /api/email/daily-consistency`
- `GET /api/email/debug-pending-alerts`
- `POST /api/email/ensure-user`
- `POST /api/admin/sync-access-users` (operación técnica)
- `POST /api/admin/create-user`

## 4. Flujo del sistema

### 4.1 Flujo operativo real (actual)
1. Llega un email de eventos a `POST /api/email-local-ingest`.
2. Se guarda copia en `apps/emails/inbox/{messageId}`.
3. Se parsea subject/body y se generan eventos normalizados.
4. Se persisten eventos deduplicados en `apps/emails/vehicleEvents/{eventId}`.
5. Se actualiza/crea `apps/emails/vehicles/{plate}`.
6. Se actualiza `apps/emails/dailyAlerts/{dateKey}/vehicles/{plate}` con:
   - `events[]`
   - `summary` por tipo
   - `riskScore`
   - `responsables`
   - `alertSent`
7. Se actualiza meta diaria en `apps/emails/dailyAlerts/{dateKey}/meta/meta`.
8. Se actualiza índice rápido por responsable en `apps/emails/responsables/{email}/alerts/{alertId}`.
9. Script `send-alerts.ps1` consulta `GET /api/email/get-pending-daily-alerts`.
10. Script envía emails vía Outlook local.
11. Script confirma envío con `POST /api/email/mark-alert-sent`.
12. Backend marca `alertSent=true` en `dailyAlerts/.../vehicles/{plate}` y en índice `responsables`.

### 4.2 Flujo frontend (panel)
1. Front obtiene Bearer token Firebase.
2. Consulta `GET /api/email/me` para validar acceso y rol.
3. Consume vistas:
   - vehículos (`my-vehicles` / `my-alerts-vehicles`)
   - alertas (`my-alerts`)
   - KPIs (`my-stats`, `my-risk`)
4. Panel admin gestiona configuración y responsables con endpoints `/api/admin/*`.

## 5. Estructura de Firestore

```text
apps/
  emails/
    inbox/{messageId}
    unclassifiedEmails/{messageId}
    vehicleEvents/{eventId}
    vehicles/{plate}
    dailyAlerts/{dateKey}
      vehicles/{plate}
      meta/meta
    responsables/{encodedEmail}
      alerts/{encodedAlertId}
    access/{email}
    config/config

apps/
  fleet/vehicles/{plate}          (lectura auxiliar)
  master/vehicles/{plate}         (lectura auxiliar)

vehicles/{plate}                  (lectura auxiliar legacy)
users/{uid}                       (autocreación por middleware auth, no específico de emails)
```

### 5.1 Qué guarda cada documento clave
- `inbox/{messageId}`:
  - email crudo ingerido + preview + timestamps.
- `vehicleEvents/{eventId}`:
  - evento normalizado individual (dedupe por hash).
- `vehicles/{plate}`:
  - estado agregado por vehículo (último evento, contadores, responsables, operación).
- `dailyAlerts/{dateKey}/vehicles/{plate}`:
  - documento diario por vehículo:
    - `events[]`, `summary`, `riskScore`, `responsables`, `alertSent`, `sentAt`.
- `dailyAlerts/{dateKey}/meta/meta`:
  - totales diarios por tipo y severidad.
- `responsables/{email}/alerts/{alertId}`:
  - índice de lectura rápida para frontend por responsable.
- `access/{email}`:
  - control de acceso módulo emails (`role`, `active/enabled`).
- `config/config`:
  - recipients globales (`generalRecipients`, `ccRecipients`, `reportRecipients`).

## 6. Contrato backend -> frontend

## Frontend Integration Guide

### 6.1 Qué debe usar el frontend
- Estado de usuario y rol:
  - `GET /api/email/me`
- Listados y analítica:
  - `GET /api/email/my-alerts`
  - `GET /api/email/my-alerts-vehicles`
  - `GET /api/email/my-stats`
  - `GET /api/email/my-risk`
  - `GET /api/email/my-vehicles` (o alias `/api/vehicles/my-vehicles`)
- Gestión admin:
  - `GET/PATCH /api/admin/email-config`
  - `PATCH /api/admin/vehicle-alerts`

### 6.2 Qué no debe usar el frontend
- Todo endpoint con `x-local-token` (ingesta, envío, debug, métricas operativas).
- `POST /api/admin/create-user`.
- `POST /api/admin/sync-access-users` salvo tooling administrativo interno.

### 6.3 Datos que el frontend puede mostrar
- Usuario/rol autorizado.
- Vehículos visibles y operación (`operationName`).
- Alertas por fecha/patente/riesgo/estado envío.
- KPIs:
  - total, pendientes, enviadas, máximo y promedio de riesgo.
- En panel admin:
  - destinatarios globales.
  - responsables por vehículo.

### 6.4 Campos que frontend puede modificar
- Panel admin:
  - `generalRecipients`
  - `ccRecipients`
  - `reportRecipients`
  - `responsables` por vehículo
- Frontend estándar (usuario final):
  - No hay endpoints de escritura dedicados a edición de alertas.

### 6.5 Ejemplos de uso

#### Fetch frontend (Bearer)
```js
const res = await fetch("/api/email/my-alerts?limit=50", {
  headers: { Authorization: `Bearer ${idToken}` }
});
const data = await res.json();
```

#### PowerShell script (x-local-token)
```powershell
Invoke-RestMethod `
  -Uri "https://controlfile.onrender.com/api/email/get-pending-daily-alerts" `
  -Method GET `
  -Headers @{ "x-local-token" = $LOCAL_TOKEN }
```

## 7. Problemas detectados

1. Inconsistencia de naming en campos:
   - `responsableEmail` (singular) y `responsableEmails` (plural) en la misma respuesta.
   - `operationName` y `operacion` coexisten.
   - `active` y `enabled` coexisten en acceso.
2. Endpoints de debug/operación expuestos bajo `/api`:
   - `GET /api/email/debug-pending-alerts`, `daily-consistency`, `daily-metrics`.
3. `POST /api/email-inbound` sin autenticación/firma de webhook en código actual.
4. Flujo `email-inbound` incompleto:
   - tiene `TODO` de persistencia.
5. Criterio de fecha inconsistente:
   - pendientes usan timezone Argentina;
   - `my-stats` usa `new Date().toISOString().slice(0,10)` (UTC).
6. Posible endpoint/superficie de alto privilegio con token local:
   - `POST /api/email/ensure-user` permite setear roles con `x-local-token`.
7. Código muerto/duplicado parcial:
   - `groupAlertsByResponsable` no se usa en `emailAlerts.js`.
   - `vehicleEventParser.js` contiene un bloque comentado duplicado grande (reduce mantenibilidad).

## 8. Recomendaciones

1. Separar públicamente rutas:
   - `frontend-api` (Bearer) vs `ops-api` (token local/IP allowlist).
2. Privatizar o eliminar endpoints de debug en producción.
3. Implementar verificación de firma para webhook inbound (`email-inbound`).
4. Estandarizar nombres:
   - usar solo `responsableEmails`, `operationName`, `enabled`.
5. Unificar timezone de negocio para todo cálculo diario (`America/Argentina/Buenos_Aires`).
6. Mantener `POST /api/email/ensure-user` solo para backend interno/admin autenticado por claims.
7. Documentar versión estable de contratos JSON (OpenAPI/Swagger) y marcar endpoints legacy.
