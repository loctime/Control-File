# Auditoria Backend - ControlFile

Generado: 2026-03-10T05:59:15.810Z

## Resumen

- Endpoints Next.js detectados: **45**
- Endpoints Express detectados: **69**
- Endpoints usados por frontend (directo): **25**
- Endpoints duplicados Next/Express: **20**
- Endpoints potencialmente muertos Next: **19**
- Endpoints potencialmente muertos Express: **44**

## Diagrama arquitectura actual

```mermaid
flowchart TD
  FE[Frontend Next.js app/components/hooks] --> NAPI[/app/api/* (Next API Routes)]
  FE -->|algunos flujos directos| EX[/backend Express en Render/]
  NAPI -->|proxy/bridge| EX
  NAPI --> FB[(Firestore)]
  NAPI --> B2[(Backblaze B2)]
  EX --> FB
  EX --> B2
  EX --> STRIPE[(Stripe)]
  EX --> GSHEETS[(Google Sheets)]
```

## Endpoints usados por frontend

| Endpoint | Archivos que lo llaman |
|---|---|
| `/api/audio/master` | `components/drive/AudioMasteringModal.tsx` |
| `/api/audio/test-simple` | `components/drive/AudioMasteringModal.tsx` |
| `/api/billing/checkout` | `app/settings/page.tsx` |
| `/api/files/delete` | `components/drive/ContextMenu.tsx`<br>`components/drive/TrashView.tsx`<br>`lib/controlfile-sdk.ts` |
| `/api/files/empty-trash` | `components/drive/TrashView.tsx` |
| `/api/files/list` | `lib/controlfile-sdk.ts` |
| `/api/files/presign-get` | `hooks/useContextMenuActions.ts`<br>`hooks/useFileDownloadUrl.ts`<br>`lib/controlfile-sdk.ts` |
| `/api/files/proxy-download` | `components/drive/details/FilePreview.tsx`<br>`components/drive/DetailsPanel.tsx`<br>`components/drive/ImageCropModal.tsx` |
| `/api/files/rename` | `lib/controlfile-sdk.ts` |
| `/api/files/replace` | `components/drive/details/FilePreview.tsx`<br>`lib/controlfile-sdk.ts` |
| `/api/files/zip` | `components/drive/DetailsPanel.tsx` |
| `/api/folders/permanent-delete` | `components/drive/TrashView.tsx` |
| `/api/health` | `hooks/useConnectionStatus.ts` |
| `/api/platform/accounts` | `app/platform/console/page.tsx` |
| `/api/platform/payments` | `app/platform/console/page.tsx` |
| `/api/platform/plans` | `app/platform/console/page.tsx` |
| `/api/shares` | `app/share/[token]/page.tsx` |
| `/api/shares/create` | `components/drive/FileExplorer.tsx`<br>`hooks/useContextMenuActions.ts` |
| `/api/uploads/confirm` | `lib/controlfile-sdk.ts` |
| `/api/uploads/presign` | `lib/controlfile-sdk.ts` |
| `/api/uploads/proxy-upload` | `hooks/useProxyUpload.ts` |
| `/api/user/plan` | `app/settings/page.tsx` |
| `/api/user/settings` | `app/settings/page.tsx` |
| `/api/user/taskbar` | `hooks/useTaskbar.ts` |
| `/api/users/profile` | `components/user/UserProfile.tsx` |

## Endpoints duplicados (Next y Express)

| Endpoint normalizado | Next (metodos/archivo) | Express (metodos/archivo) |
|---|---|---|
| `/api/admin/create-user` | `OPTIONS,POST app/api/admin/create-user/route.ts` | `POST backend/src/routes/admin.js` |
| `/api/audio/master` | `POST,GET app/api/audio/master/route.ts` | `POST backend/src/routes/audio.js` |
| `/api/audio/test-ffmpeg` | `GET app/api/audio/test-ffmpeg/route.ts` | `GET backend/src/routes/audio.js` |
| `/api/files/delete` | `POST app/api/files/delete/route.ts`<br>`ANY app/api/files/delete/route.v2.ts` | `POST backend/src/routes/files.js` |
| `/api/files/presign-get` | `POST app/api/files/presign-get/route.ts` | `POST backend/src/routes/files.js` |
| `/api/files/rename` | `POST app/api/files/rename/route.ts` | `POST backend/src/routes/files.js` |
| `/api/files/zip` | `POST app/api/files/zip/route.ts` | `POST backend/src/routes/files.js` |
| `/api/folders/by-slug/:param/:param` | `GET app/api/folders/by-slug/[username]/[...path]/route.ts` | `GET backend/src/routes/folders.js` |
| `/api/folders/create` | `POST app/api/folders/create/route.ts` | `POST backend/src/routes/folders.js` |
| `/api/folders/root` | `GET app/api/folders/root/route.ts` | `GET backend/src/routes/folders.js` |
| `/api/health` | `GET,HEAD app/api/health/route.ts` | `GET backend/src/routes/health.js` |
| `/api/shares/:param` | `GET app/api/shares/[token]/route.ts` | `GET backend/src/routes/shares.js` |
| `/api/shares/:param/download` | `POST app/api/shares/[token]/download/route.ts` | `POST backend/src/routes/shares.js` |
| `/api/shares/:param/image` | `GET app/api/shares/[token]/image/route.ts` | `GET backend/src/routes/shares.js`<br>`OPTIONS backend/src/routes/shares.js` |
| `/api/shares/create` | `POST app/api/shares/create/route.ts`<br>`ANY app/api/shares/create/route.v2.ts` | `POST backend/src/routes/shares.js` |
| `/api/shares/revoke` | `POST app/api/shares/revoke/route.ts` | `POST backend/src/routes/shares.js` |
| `/api/superdev/impersonate` | `POST app/api/superdev/impersonate/route.ts` | `POST backend/src/routes/superdev.js` |
| `/api/superdev/list-owners` | `GET app/api/superdev/list-owners/route.ts` | `GET backend/src/routes/superdev.js` |
| `/api/users/initialize` | `POST app/api/users/initialize/route.ts` | `POST backend/src/routes/users.js` |
| `/api/users/profile` | `GET,PUT app/api/users/profile/route.ts` | `GET backend/src/routes/users.js`<br>`PUT backend/src/routes/users.js` |

## Endpoints muertos potenciales

### Next

| Endpoint | Metodos | Archivo | Motivo |
|---|---|---|---|
| `/api/admin/create-user` | `OPTIONS,POST` | `app/api/admin/create-user/route.ts` | No aparece en llamadas frontend directas |
| `/api/audio/test-ffmpeg` | `GET` | `app/api/audio/test-ffmpeg/route.ts` | No aparece en llamadas frontend directas |
| `/api/billing/webhook` | `POST` | `app/api/billing/webhook/route.ts` | No aparece en llamadas frontend directas |
| `/api/controlfile/upload` | `ANY` | `app/api/controlfile/upload/route.ts` | No aparece en llamadas frontend directas |
| `/api/create-user` | `OPTIONS,POST` | `app/api/create-user/route.ts` | No aparece en llamadas frontend directas |
| `/api/folders/by-slug/:username/:path` | `GET` | `app/api/folders/by-slug/[username]/[...path]/route.ts` | No aparece en llamadas frontend directas |
| `/api/folders/create` | `POST` | `app/api/folders/create/route.ts` | No aparece en llamadas frontend directas |
| `/api/folders/root` | `GET` | `app/api/folders/root/route.ts` | No aparece en llamadas frontend directas |
| `/api/folders/set-main` | `POST` | `app/api/folders/set-main/route.ts` | No aparece en llamadas frontend directas |
| `/api/platform/accounts/:uid` | `GET,PATCH` | `app/api/platform/accounts/[uid]/route.ts` | No aparece en llamadas frontend directas |
| `/api/platform/accounts/ensure` | `POST` | `app/api/platform/accounts/ensure/route.ts` | No aparece en llamadas frontend directas |
| `/api/platform/plans/:planId` | `GET,PATCH` | `app/api/platform/plans/[planId]/route.ts` | No aparece en llamadas frontend directas |
| `/api/shares/:token` | `GET` | `app/api/shares/[token]/route.ts` | No aparece en llamadas frontend directas |
| `/api/shares/:token/download` | `POST` | `app/api/shares/[token]/download/route.ts` | No aparece en llamadas frontend directas |
| `/api/shares/:token/image` | `GET` | `app/api/shares/[token]/image/route.ts` | No aparece en llamadas frontend directas |
| `/api/shares/revoke` | `POST` | `app/api/shares/revoke/route.ts` | No aparece en llamadas frontend directas |
| `/api/superdev/impersonate` | `POST` | `app/api/superdev/impersonate/route.ts` | No aparece en llamadas frontend directas |
| `/api/superdev/list-owners` | `GET` | `app/api/superdev/list-owners/route.ts` | No aparece en llamadas frontend directas |
| `/api/users/initialize` | `POST` | `app/api/users/initialize/route.ts` | No aparece en llamadas frontend directas |

### Express

| Endpoint | Metodo | Archivo | Motivo |
|---|---|---|---|
| `/api/accounts/ensure` | `POST` | `backend/src/routes/accounts.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/accounts/me` | `GET` | `backend/src/routes/accounts.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/admin/email-config` | `GET` | `backend/src/routes/admin.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/admin/email-config` | `PATCH` | `backend/src/routes/admin.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/admin/sync-access-users` | `POST` | `backend/src/routes/admin.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/admin/vehicle-alerts` | `PATCH` | `backend/src/routes/admin.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/audio/info/:fileId` | `GET` | `backend/src/routes/audio.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/cache/clear` | `POST` | `backend/src/index.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/cache/stats` | `GET` | `backend/src/index.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/chat/query` | `POST` | `backend/src/routes/chat.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/chat/status` | `GET` | `backend/src/routes/chat.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/dashboard/summary` | `GET` | `backend/src/routes/dashboard.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/email-inbound` | `POST` | `backend/src/routes/emailWebhook.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/email-local-ingest` | `POST` | `backend/src/routes/email-receptor.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/email/daily-consistency` | `GET` | `backend/src/routes/emailAlerts.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/email/daily-metrics` | `GET` | `backend/src/routes/emailAlerts.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/email/debug-pending-alerts` | `GET` | `backend/src/routes/emailAlerts.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/email/get-pending-daily-alerts` | `GET` | `backend/src/routes/emailAlerts.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/email/mark-alert-sent` | `POST` | `backend/src/routes/emailAlerts.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/email/sync-access-users` | `POST` | `backend/src/routes/emailAlerts.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/feedback/` | `GET` | `backend/src/routes/feedback.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/feedback/` | `POST` | `backend/src/routes/feedback.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/feedback/:feedbackId` | `PATCH` | `backend/src/routes/feedback.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/files/permanent-delete` | `POST` | `backend/src/routes/files.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/files/restore` | `POST` | `backend/src/routes/files.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/folders/` | `GET` | `backend/src/routes/folders.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/folders/` | `POST` | `backend/src/routes/folders.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/github/status` | `GET` | `backend/src/routes/github-status.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/horarios/semana-actual` | `GET` | `backend/src/routes/horarios.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/horarios/semana-actual` | `POST` | `backend/src/routes/horarios.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/repository/index` | `POST` | `backend/src/routes/repository-index.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/repository/status/:repositoryId` | `GET` | `backend/src/routes/repository-index.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/shares/:token/increment-counter` | `POST` | `backend/src/routes/shares.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/stores/:storeId/backup` | `POST` | `backend/src/routes/stores/sheets.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/stores/:storeId/products` | `GET` | `backend/src/routes/stores/sheets.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/stores/:storeId/sheets/create` | `POST` | `backend/src/routes/stores/sheets.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/stores/:storeId/sheets/sync` | `POST` | `backend/src/routes/stores/sheets.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/test-upload` | `POST` | `backend/src/index.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/api/users/by-username/:username` | `GET` | `backend/src/routes/users.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/health` | `GET` | `backend/src/index.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/repositories/:repositoryId/status` | `GET` | `backend/src/routes/repositories.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/repositories/index` | `POST` | `backend/src/routes/repositories.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/upload` | `POST` | `backend/src/index.js` | No lo llama frontend y no tiene espejo en /app/api |
| `/upload/` | `POST` | `backend/src/routes/external-upload.js` | No lo llama frontend y no tiene espejo en /app/api |

## Inventario completo de endpoints

| Endpoint | Metodo(s) | Archivo | Backend | Que hace | Servicios usados | Colecciones Firestore |
|---|---|---|---|---|---|---|
| `/api/accounts/ensure` | `POST` | `backend/src/routes/accounts.js` | express | Cuenta/app ownership | - | platform, accounts |
| `/api/accounts/me` | `GET` | `backend/src/routes/accounts.js` | express | Cuenta/app ownership | - | platform, accounts |
| `/api/admin/create-user` | `OPTIONS,POST` | `app/api/admin/create-user/route.ts` | next | Endpoint de dominio espec?fico | @/lib/firebase-admin, @/lib/logger-client | - |
| `/api/admin/create-user` | `POST` | `backend/src/routes/admin.js` | express | Endpoint de dominio espec?fico | ../services/vehicleEventService | apps, vehicles, config |
| `/api/admin/email-config` | `GET` | `backend/src/routes/admin.js` | express | Endpoint de dominio espec?fico | ../services/vehicleEventService | apps, vehicles, config |
| `/api/admin/email-config` | `PATCH` | `backend/src/routes/admin.js` | express | Endpoint de dominio espec?fico | ../services/vehicleEventService | apps, vehicles, config |
| `/api/admin/sync-access-users` | `POST` | `backend/src/routes/admin.js` | express | Endpoint de dominio espec?fico | ../services/vehicleEventService | apps, vehicles, config |
| `/api/admin/vehicle-alerts` | `PATCH` | `backend/src/routes/admin.js` | express | Endpoint de dominio espec?fico | ../services/vehicleEventService | apps, vehicles, config |
| `/api/audio/info/:fileId` | `GET` | `backend/src/routes/audio.js` | express | Endpoint de dominio espec?fico | ../services/b2, ../services/audio-processing, ../services/audio-processing-simple, ../services/metadata | files, users |
| `/api/audio/master` | `POST,GET` | `app/api/audio/master/route.ts` | next | Masterizaci?n de audio | @/lib/logger-client, @/lib/firebase-admin, /api/audio/master, /api/audio/info | files |
| `/api/audio/master` | `POST` | `backend/src/routes/audio.js` | express | Masterizaci?n de audio | ../services/b2, ../services/audio-processing, ../services/audio-processing-simple, ../services/metadata | files, users |
| `/api/audio/test-ffmpeg` | `GET` | `app/api/audio/test-ffmpeg/route.ts` | next | Diagn?stico audio/ffmpeg | @/lib/logger-client, @/lib/firebase-admin, /api/audio/test-ffmpeg | - |
| `/api/audio/test-ffmpeg` | `GET` | `backend/src/routes/audio.js` | express | Diagn?stico audio/ffmpeg | ../services/b2, ../services/audio-processing, ../services/audio-processing-simple, ../services/metadata | files, users |
| `/api/audio/test-simple` | `POST` | `app/api/audio/test-simple/route.ts` | next | Diagn?stico audio/ffmpeg | @/lib/logger-client, @/lib/firebase-admin | - |
| `/api/billing/checkout` | `POST` | `app/api/billing/checkout/route.ts` | next | Inicia checkout de Stripe | @/lib/logger-client, @/lib/firebase-admin, @/lib/plans | - |
| `/api/billing/webhook` | `POST` | `app/api/billing/webhook/route.ts` | next | Webhook Stripe | @/lib/logger-client, @/lib/firebase-admin, @/lib/plans | users |
| `/api/cache/clear` | `POST` | `backend/src/index.js` | express | Endpoint de dominio espec?fico | ./middleware/auth, ./middleware/superdev-auth, ./middleware/cache, ./middleware/request-logger | apps |
| `/api/cache/stats` | `GET` | `backend/src/index.js` | express | Endpoint de dominio espec?fico | ./middleware/auth, ./middleware/superdev-auth, ./middleware/cache, ./middleware/request-logger | apps |
| `/api/chat/query` | `POST` | `backend/src/routes/chat.js` | express | Consulta chat sobre repositorios | ../services/repository-store, ../services/chat-service | - |
| `/api/chat/status` | `GET` | `backend/src/routes/chat.js` | express | Consulta chat sobre repositorios | ../services/repository-store, ../services/chat-service | - |
| `/api/controlfile/upload` | `ANY` | `app/api/controlfile/upload/route.ts` | next | Endpoint de dominio espec?fico | @/lib/middleware/api-auth, @/lib/firebase-admin, @/lib/b2, @/lib/logger-client | files |
| `/api/create-user` | `OPTIONS,POST` | `app/api/create-user/route.ts` | next | Endpoint de dominio espec?fico | @/lib/firebase-admin, @/lib/logger-client | - |
| `/api/dashboard/summary` | `GET` | `backend/src/routes/dashboard.js` | express | Endpoint de dominio espec?fico | - | apps, dailyAlerts, meta, vehicles |
| `/api/email-inbound` | `POST` | `backend/src/routes/emailWebhook.js` | express | Endpoint de dominio espec?fico | - | apps |
| `/api/email-local-ingest` | `POST` | `backend/src/routes/email-receptor.js` | express | Endpoint de dominio espec?fico | ../services/vehicleEventParser, ../services/vehicleEventService | _, apps, inbox, unclassifiedEmails |
| `/api/email/daily-consistency` | `GET` | `backend/src/routes/emailAlerts.js` | express | Flujos email (ingesta/alertas/m?tricas) | ../services/vehicleEventService, ../services/dailyMetricsService, ../services/email/emailTemplateBuilder | apps, dailyAlerts, vehicles, meta, responsables, alerts ... |
| `/api/email/daily-metrics` | `GET` | `backend/src/routes/emailAlerts.js` | express | Flujos email (ingesta/alertas/m?tricas) | ../services/vehicleEventService, ../services/dailyMetricsService, ../services/email/emailTemplateBuilder | apps, dailyAlerts, vehicles, meta, responsables, alerts ... |
| `/api/email/debug-pending-alerts` | `GET` | `backend/src/routes/emailAlerts.js` | express | Flujos email (ingesta/alertas/m?tricas) | ../services/vehicleEventService, ../services/dailyMetricsService, ../services/email/emailTemplateBuilder | apps, dailyAlerts, vehicles, meta, responsables, alerts ... |
| `/api/email/get-pending-daily-alerts` | `GET` | `backend/src/routes/emailAlerts.js` | express | Flujos email (ingesta/alertas/m?tricas) | ../services/vehicleEventService, ../services/dailyMetricsService, ../services/email/emailTemplateBuilder | apps, dailyAlerts, vehicles, meta, responsables, alerts ... |
| `/api/email/mark-alert-sent` | `POST` | `backend/src/routes/emailAlerts.js` | express | Flujos email (ingesta/alertas/m?tricas) | ../services/vehicleEventService, ../services/dailyMetricsService, ../services/email/emailTemplateBuilder | apps, dailyAlerts, vehicles, meta, responsables, alerts ... |
| `/api/email/sync-access-users` | `POST` | `backend/src/routes/emailAlerts.js` | express | Flujos email (ingesta/alertas/m?tricas) | ../services/vehicleEventService, ../services/dailyMetricsService, ../services/email/emailTemplateBuilder | apps, dailyAlerts, vehicles, meta, responsables, alerts ... |
| `/api/feedback/` | `GET` | `backend/src/routes/feedback.js` | express | Recepci?n y gesti?n de feedback | ../services/feedback-service | feedback |
| `/api/feedback/` | `POST` | `backend/src/routes/feedback.js` | express | Recepci?n y gesti?n de feedback | ../services/feedback-service | feedback |
| `/api/feedback/:feedbackId` | `PATCH` | `backend/src/routes/feedback.js` | express | Recepci?n y gesti?n de feedback | ../services/feedback-service | feedback |
| `/api/files/delete` | `POST` | `app/api/files/delete/route.ts` | next | Borrado l?gico a papelera | @/lib/logger-client, @/lib/firebase-admin, @/lib/b2 | files, users |
| `/api/files/delete` | `ANY` | `app/api/files/delete/route.v2.ts` | next | Borrado l?gico a papelera | @/lib/firebase-admin, @/lib/b2, @/lib/middleware/api-auth, @/lib/schemas/api-schemas, @/lib/logger | files, orphanedFiles, users |
| `/api/files/delete` | `POST` | `backend/src/routes/files.js` | express | Borrado l?gico a papelera | ../services/b2, ../middleware/cache | files, users |
| `/api/files/empty-trash` | `POST` | `app/api/files/empty-trash/route.ts` | next | Endpoint de dominio espec?fico | @/lib/logger-client, @/lib/firebase-admin, @/lib/b2 | files, users |
| `/api/files/list` | `GET` | `backend/src/routes/files.js` | express | Lista archivos/carpetas | ../services/b2, ../middleware/cache | files, users |
| `/api/files/permanent-delete` | `POST` | `backend/src/routes/files.js` | express | Borrado f?sico definitivo | ../services/b2, ../middleware/cache | files, users |
| `/api/files/presign-get` | `POST` | `app/api/files/presign-get/route.ts` | next | Genera URL temporal de descarga | @/lib/logger-client, @/lib/firebase-admin, @/lib/b2 | files |
| `/api/files/presign-get` | `POST` | `backend/src/routes/files.js` | express | Genera URL temporal de descarga | ../services/b2, ../middleware/cache | files, users |
| `/api/files/proxy-download` | `POST` | `app/api/files/proxy-download/route.ts` | next | Proxy de descarga (evita exponer URL directa) | @/lib/logger-client, /api/files/presign-get | - |
| `/api/files/rename` | `POST` | `app/api/files/rename/route.ts` | next | Renombra archivo | @/lib/logger-client, @/lib/firebase-admin | files |
| `/api/files/rename` | `POST` | `backend/src/routes/files.js` | express | Renombra archivo | ../services/b2, ../middleware/cache | files, users |
| `/api/files/replace` | `POST` | `backend/src/routes/files.js` | express | Reemplaza contenido conservando ID | ../services/b2, ../middleware/cache | files, users |
| `/api/files/restore` | `POST` | `backend/src/routes/files.js` | express | Restaura desde papelera | ../services/b2, ../middleware/cache | files, users |
| `/api/files/zip` | `POST` | `app/api/files/zip/route.ts` | next | Descarga m?ltiple como ZIP | @/lib/logger-client, /api/files/zip | - |
| `/api/files/zip` | `POST` | `backend/src/routes/files.js` | express | Descarga m?ltiple como ZIP | ../services/b2, ../middleware/cache | files, users |
| `/api/folders/` | `GET` | `backend/src/routes/folders.js` | express | Endpoint de dominio espec?fico | ../services/metadata, ../middleware/cache, ../services/contract-validators, ../services/contract-metrics, ../services/contract-feature-flags | files, users, userSettings |
| `/api/folders/` | `POST` | `backend/src/routes/folders.js` | express | Endpoint de dominio espec?fico | ../services/metadata, ../middleware/cache, ../services/contract-validators, ../services/contract-metrics, ../services/contract-feature-flags | files, users, userSettings |
| `/api/folders/by-slug/:username/:path` | `GET` | `app/api/folders/by-slug/[username]/[...path]/route.ts` | next | Resuelve carpeta por slug | @/lib/logger-client, /api/folders/by-slug | - |
| `/api/folders/by-slug/:username/:path(*)` | `GET` | `backend/src/routes/folders.js` | express | Resuelve carpeta por slug | ../services/metadata, ../middleware/cache, ../services/contract-validators, ../services/contract-metrics, ../services/contract-feature-flags | files, users, userSettings |
| `/api/folders/create` | `POST` | `app/api/folders/create/route.ts` | next | Crea carpeta | @/lib/firebase-admin, @/lib/logger-client, @/lib/utils/app-ownership | files |
| `/api/folders/create` | `POST` | `backend/src/routes/folders.js` | express | Crea carpeta | ../services/metadata, ../middleware/cache, ../services/contract-validators, ../services/contract-metrics, ../services/contract-feature-flags | files, users, userSettings |
| `/api/folders/permanent-delete` | `POST` | `app/api/folders/permanent-delete/route.ts` | next | Endpoint de dominio espec?fico | @/lib/logger-client, @/lib/firebase-admin, @/lib/b2 | files |
| `/api/folders/root` | `GET` | `app/api/folders/root/route.ts` | next | Obtiene/crea carpeta ra?z | @/lib/logger-client, /api/folders/root | - |
| `/api/folders/root` | `GET` | `backend/src/routes/folders.js` | express | Obtiene/crea carpeta ra?z | ../services/metadata, ../middleware/cache, ../services/contract-validators, ../services/contract-metrics, ../services/contract-feature-flags | files, users, userSettings |
| `/api/folders/set-main` | `POST` | `app/api/folders/set-main/route.ts` | next | Endpoint de dominio espec?fico | @/lib/firebase-admin, @/lib/logger-client, @/lib/utils/app-ownership | files |
| `/api/github/status` | `GET` | `backend/src/routes/github-status.js` | express | Endpoint de dominio espec?fico | - | - |
| `/api/health` | `GET,HEAD` | `app/api/health/route.ts` | next | Health check | - | - |
| `/api/health/` | `GET` | `backend/src/routes/health.js` | express | Health check | - | - |
| `/api/horarios/semana-actual` | `GET` | `backend/src/routes/horarios.js` | express | Lectura/carga de horarios | ../services/b2 | - |
| `/api/horarios/semana-actual` | `POST` | `backend/src/routes/horarios.js` | express | Lectura/carga de horarios | ../services/b2 | - |
| `/api/platform/accounts` | `GET` | `app/api/platform/accounts/route.ts` | next | Administraci?n de cuentas plataforma | @/lib/firebase-admin, @/lib/platform/accounts | platform, accounts |
| `/api/platform/accounts/:uid` | `GET,PATCH` | `app/api/platform/accounts/[uid]/route.ts` | next | Administraci?n de cuentas plataforma | @/lib/firebase-admin, @/lib/platform/audit, @/lib/platform/accounts | platform, accounts, plans |
| `/api/platform/accounts/ensure` | `POST` | `app/api/platform/accounts/ensure/route.ts` | next | Administraci?n de cuentas plataforma | @/lib/firebase-admin | platform, accounts |
| `/api/platform/payments` | `GET,POST` | `app/api/platform/payments/route.ts` | next | Historial/estado de pagos plataforma | @/lib/firebase-admin, @/lib/platform/audit, @/lib/platform/payments | platform, payments |
| `/api/platform/plans` | `GET,POST,PATCH` | `app/api/platform/plans/route.ts` | next | Administraci?n de planes plataforma | @/lib/firebase-admin, @/lib/platform/audit, @/lib/platform/plans | platform, plans |
| `/api/platform/plans/:planId` | `GET,PATCH` | `app/api/platform/plans/[planId]/route.ts` | next | Administraci?n de planes plataforma | @/lib/firebase-admin, @/lib/platform/audit, @/lib/platform/plans | platform, plans |
| `/api/repository/index` | `POST` | `backend/src/routes/repository-index.js` | express | Endpoint de dominio espec?fico | ../services/repository-lock, ../services/repository-indexer | apps, repositories, brains, metrics |
| `/api/repository/status/:repositoryId` | `GET` | `backend/src/routes/repository-index.js` | express | Endpoint de dominio espec?fico | ../services/repository-lock, ../services/repository-indexer | apps, repositories, brains, metrics |
| `/api/shares/` | `GET` | `backend/src/routes/shares.js` | express | Endpoint de dominio espec?fico | ../services/b2, ../middleware/auth, ../services/cloudmersive | files, shares |
| `/api/shares/:token` | `GET` | `app/api/shares/[token]/route.ts` | next | Obtiene metadata p?blica del share | @/lib/logger-client, /api/shares | - |
| `/api/shares/:token` | `GET` | `backend/src/routes/shares.js` | express | Obtiene metadata p?blica del share | ../services/b2, ../middleware/auth, ../services/cloudmersive | files, shares |
| `/api/shares/:token/download` | `POST` | `app/api/shares/[token]/download/route.ts` | next | Registra/autoriza descarga p?blica | @/lib/logger-client, /api/shares | - |
| `/api/shares/:token/download` | `POST` | `backend/src/routes/shares.js` | express | Registra/autoriza descarga p?blica | ../services/b2, ../middleware/auth, ../services/cloudmersive | files, shares |
| `/api/shares/:token/image` | `GET` | `app/api/shares/[token]/image/route.ts` | next | Sirve imagen p?blica por token | @/lib/logger-client, /api/shares | - |
| `/api/shares/:token/image` | `GET` | `backend/src/routes/shares.js` | express | Sirve imagen p?blica por token | ../services/b2, ../middleware/auth, ../services/cloudmersive | files, shares |
| `/api/shares/:token/image` | `OPTIONS` | `backend/src/routes/shares.js` | express | Sirve imagen p?blica por token | ../services/b2, ../middleware/auth, ../services/cloudmersive | files, shares |
| `/api/shares/:token/increment-counter` | `POST` | `backend/src/routes/shares.js` | express | Obtiene metadata p?blica del share | ../services/b2, ../middleware/auth, ../services/cloudmersive | files, shares |
| `/api/shares/create` | `POST` | `app/api/shares/create/route.ts` | next | Crea enlace compartido | @/lib/logger-client, @/lib/firebase-admin | files, shares |
| `/api/shares/create` | `ANY` | `app/api/shares/create/route.v2.ts` | next | Crea enlace compartido | @/lib/firebase-admin, @/lib/middleware/api-auth, @/lib/schemas/api-schemas, @/lib/logger | files, shares |
| `/api/shares/create` | `POST` | `backend/src/routes/shares.js` | express | Crea enlace compartido | ../services/b2, ../middleware/auth, ../services/cloudmersive | files, shares |
| `/api/shares/revoke` | `POST` | `app/api/shares/revoke/route.ts` | next | Revoca enlace compartido | @/lib/logger-client, @/lib/firebase-admin | shares |
| `/api/shares/revoke` | `POST` | `backend/src/routes/shares.js` | express | Revoca enlace compartido | ../services/b2, ../middleware/auth, ../services/cloudmersive | files, shares |
| `/api/stores/:storeId/backup` | `POST` | `backend/src/routes/stores/sheets.js` | express | Sync de Google Sheets/Stores | - | stores, products |
| `/api/stores/:storeId/products` | `GET` | `backend/src/routes/stores/sheets.js` | express | Sync de Google Sheets/Stores | - | stores, products |
| `/api/stores/:storeId/sheets/create` | `POST` | `backend/src/routes/stores/sheets.js` | express | Sync de Google Sheets/Stores | - | stores, products |
| `/api/stores/:storeId/sheets/sync` | `POST` | `backend/src/routes/stores/sheets.js` | express | Sync de Google Sheets/Stores | - | stores, products |
| `/api/superdev/impersonate` | `POST` | `app/api/superdev/impersonate/route.ts` | next | Impersonaci?n superdev | @/lib/firebase-admin, @/lib/logger, @/lib/middleware/superdev-auth | apps, owners |
| `/api/superdev/impersonate` | `POST` | `backend/src/routes/superdev.js` | express | Impersonaci?n superdev | - | apps, owners |
| `/api/superdev/list-owners` | `GET` | `app/api/superdev/list-owners/route.ts` | next | Lista owners | @/lib/firebase-admin, @/lib/logger, @/lib/middleware/superdev-auth | apps, owners |
| `/api/superdev/list-owners` | `GET` | `backend/src/routes/superdev.js` | express | Lista owners | - | apps, owners |
| `/api/test-upload` | `POST` | `backend/src/index.js` | express | Endpoint de dominio espec?fico | ./middleware/auth, ./middleware/superdev-auth, ./middleware/cache, ./middleware/request-logger | apps |
| `/api/uploads/confirm` | `POST` | `app/api/uploads/confirm/route.ts` | next | Confirma upload y persiste metadata | @/lib/logger-client, @/lib/firebase-admin | uploadSessions, files, users |
| `/api/uploads/confirm` | `ANY` | `app/api/uploads/confirm/route.v2.ts` | next | Confirma upload y persiste metadata | @/lib/firebase-admin, @/lib/middleware/api-auth, @/lib/schemas/api-schemas, @/lib/logger, @/lib/b2 | uploadFingerprints, uploadSessions, files, users |
| `/api/uploads/presign` | `POST` | `app/api/uploads/presign/route.ts` | next | Genera URL prefirmada para subida | @/lib/logger-client, @/lib/firebase-admin, @/lib/b2 | files, users, uploadSessions |
| `/api/uploads/presign` | `ANY` | `app/api/uploads/presign/route.v2.ts` | next | Genera URL prefirmada para subida | @/lib/firebase-admin, @/lib/b2, @/lib/middleware/api-auth, @/lib/schemas/api-schemas, @/lib/logger | files, users, uploadSessions |
| `/api/uploads/proxy-upload` | `POST` | `app/api/uploads/proxy-upload/route.ts` | next | Subida proxy v?a backend | @/lib/logger-client, /api/uploads/proxy-upload | - |
| `/api/user/plan` | `POST` | `app/api/user/plan/route.ts` | next | Obtiene plan actual para UI | @/lib/logger-client, @/lib/firebase-admin, @/lib/plans | users |
| `/api/user/settings` | `GET,POST` | `app/api/user/settings/route.ts` | next | Lee/guarda settings de usuario | @/lib/logger-client, @/lib/firebase-admin | userSettings |
| `/api/user/taskbar` | `GET,POST` | `app/api/user/taskbar/route.ts` | next | Lee/guarda taskbar | @/lib/logger-client, /api/user/taskbar | - |
| `/api/users/by-username/:username` | `GET` | `backend/src/routes/users.js` | express | Endpoint de dominio espec?fico | - | users |
| `/api/users/initialize` | `POST` | `app/api/users/initialize/route.ts` | next | Inicializa usuario y datos base | @/lib/logger-client, /api/users/initialize | - |
| `/api/users/initialize` | `POST` | `backend/src/routes/users.js` | express | Inicializa usuario y datos base | - | users |
| `/api/users/profile` | `GET,PUT` | `app/api/users/profile/route.ts` | next | Lee/actualiza perfil | @/lib/logger-client, /api/users/profile | - |
| `/api/users/profile` | `GET` | `backend/src/routes/users.js` | express | Lee/actualiza perfil | - | users |
| `/api/users/profile` | `PUT` | `backend/src/routes/users.js` | express | Lee/actualiza perfil | - | users |
| `/health` | `GET` | `backend/src/index.js` | express | Health check | ./middleware/auth, ./middleware/superdev-auth, ./middleware/cache, ./middleware/request-logger | apps |
| `/repositories/:repositoryId/status` | `GET` | `backend/src/routes/repositories.js` | express | Indexaci?n/estado de repositorio | ../services/repository-store, ../services/repository-indexer-async | - |
| `/repositories/index` | `POST` | `backend/src/routes/repositories.js` | express | Indexaci?n/estado de repositorio | ../services/repository-store, ../services/repository-indexer-async | - |
| `/upload` | `POST` | `backend/src/index.js` | express | Endpoint de dominio espec?fico | ./middleware/auth, ./middleware/superdev-auth, ./middleware/cache, ./middleware/request-logger | apps |
| `/upload/` | `POST` | `backend/src/routes/external-upload.js` | express | Endpoint de dominio espec?fico | ../services/b2 | files |

## Propuesta de arquitectura final (backend unico ControlFile)

- Mantener **solo Express (Render) como backend canonico** para reglas de negocio, auth, B2 y Firestore.
- Reducir `app/api/*` a: webhooks de plataforma estrictamente Next-only (si aplica) y/o BFF minimo temporal.
- Migrar todos los proxies Next actuales a llamadas frontend directas al backend central mediante un SDK HTTP unico.
- Definir versionado de API (`/v1`) y contrato unico por dominio (files, folders, shares, users, platform, logistics).
- Centralizar middlewares (auth, rate-limit, auditoria, idempotencia, trazas) en Express.
- Unificar observabilidad: request-id, logs estructurados, metricas y panel de uso por endpoint.

## Archivos candidatos a eliminacion o consolidacion

- Duplicados Next que solo proxyean al backend Express en `app/api/**` (ver tabla de duplicados).
- Versiones legacy `.v2.ts` no enlazadas desde `route.ts`:
  - `app/api/files/delete/route.v2.ts`
  - `app/api/shares/create/route.v2.ts`
  - `app/api/uploads/confirm/route.v2.ts`
  - `app/api/uploads/presign/route.v2.ts`
- Rutas Express legacy solapadas de repositorios:
  - `backend/src/routes/repository-index.js` (legacy)
  - consolidar con `backend/src/routes/repositories.js`
- Endpoints de prueba/debug sin consumo productivo detectable:
  - `/api/test-upload`, `/api/uploads/test-no-auth`, `/api/uploads/test`, `/api/audio/test-ffmpeg`
