# Migration Status - Backend Unification

Updated: 2026-03-10

## Completed in this batch

- Completed Express v1 parity for remaining core operations:
  - `POST /v1/files/empty-trash`
  - `POST /v1/folders/permanent-delete`
  - `POST /v1/folders/set-main`
- Converted all Next routes in core domains to proxy-only handlers (no business logic):
  - `app/api/files/*`
  - `app/api/folders/*`
  - `app/api/shares/*`
  - `app/api/uploads/*`
- Migrated frontend core-domain calls from `fetch('/api/...')` to SDK methods.
  - Remaining direct `/api` call in frontend: `GET /api/health` (allowed temporary exception).
- Strengthened legacy telemetry headers/logging for `/api/*` in backend:
  - `Deprecation`, `Sunset`, `Link`, `X-Legacy-Route`
  - usage logs include method/path/actor/source/requestId.

## Backward compatibility policy

- Legacy `/api/*` remains active during drain period.
- Canonical endpoints are `/v1/*`.
- Legacy responses include:
  - `Deprecation: true`
  - `Sunset: Tue, 30 Jun 2026 00:00:00 GMT` (default)
  - `Link: <migration doc>; rel="deprecation"`
  - `X-Legacy-Route: true`

## Controlled removal readiness (`/api/*`)

A legacy route is removable only when all conditions are true:

1. `0` traffic for at least 2 releases in `[legacy-api-usage]` logs.
2. Frontend path already migrated to SDK + `/v1/*`.
3. No external consumer detected in telemetry source/origin.
4. Runbook rollback path documented (re-enable mount or proxy).

## Remaining work

- Migrate any non-core frontend direct backend calls to SDK where still applicable.
- Add CI guard to block new direct `fetch('/api/...')` usage outside approved exceptions (`/api/health`, webhooks).
- Remove legacy `.v2` proxy aliases after zero traffic confirmation.
- Execute phased unmount of `/api/files|folders|shares|uploads` after readiness criteria is met.
