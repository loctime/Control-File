# Migration Status - Backend Unification

Updated: 2026-03-10

## Completed in this batch

- Added canonical `v1` mounts in Express for core domains (`files`, `folders`, `uploads`, `shares`, `users`, `audio`, `admin`, `superdev`).
- Added legacy deprecation/sunset headers and usage telemetry for `/api/*` backend traffic.
- Migrated user domain logic to backend Express:
  - `GET/POST /v1/users/settings`
  - `GET/POST /v1/users/taskbar`
  - `POST /v1/users/plan`
- Added platform domain in backend Express:
  - `accounts`, `plans`, `payments` routes under `/v1/platform/*`
- Added billing checkout in backend Express:
  - `POST /v1/billing/checkout`
- Added ControlFile external upload in backend Express:
  - `POST /v1/controlfile/upload`
- Converted Next API business endpoints to thin proxies for migrated domains:
  - `app/api/platform/*`
  - `app/api/billing/checkout`
  - `app/api/controlfile/upload`
  - `app/api/user/*`
- Migrated key frontend flows to SDK client (`controlfile-sdk` wrapper):
  - Platform console data loading
  - Taskbar load/save hook
  - User settings read/write
  - User plan update
  - Billing checkout session creation

## Backward compatibility policy

- Legacy `/api/*` remains active.
- Canonical endpoints are `/v1/*`.
- Legacy responses include:
  - `Deprecation: true`
  - `Sunset: Tue, 30 Jun 2026 00:00:00 GMT` (default)
  - `Link: <migration doc>; rel="deprecation"`
- Legacy usage is logged with `[legacy-api-usage]` for cutover monitoring.

## Pending migration work

- Convert remaining Next API business routes to thin proxies (or remove):
  - `files/*`, `folders/*`, `shares/*`, `uploads/*`, `audio/*`, `admin/*`, `superdev/*` where logic still exists in frontend layer.
- Add canonical backend route coverage for any endpoints still only in Next.
- Replace remaining frontend direct `fetch('/api/...')` calls with SDK methods.
- Add CI rule to block new direct `/api/*` usage outside allowed exceptions.
- Execute endpoint-by-endpoint traffic drain and deletion once `/api` usage reaches zero.
