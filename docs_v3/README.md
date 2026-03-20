# ControlFile – Backend Documentation v3

**Authoritative backend documentation. Clean, consolidated, no legacy confusion.**

> Ground truth: `TRUTH.md` (in `docs/docs_v2/`)
> This documentation was generated from an audit of all prior docs and verified against the actual route files.

---

## Documents

| File | Contents |
|---|---|
| [00_AUDIT_REPORT.md](./00_AUDIT_REPORT.md) | What was wrong with previous docs and what was fixed |
| [01_overview.md](./01_overview.md) | What ControlFile is · Role as shared backend · App relationships |
| [02_architecture.md](./02_architecture.md) | System components · Proxy layer · Request lifecycle |
| [03_authentication.md](./03_authentication.md) | Firebase ID Tokens · Custom claims · Ownership enforcement · IAM |
| [04_files_and_folders.md](./04_files_and_folders.md) | Unified `files` collection · Hierarchy · Soft delete · Quota |
| [05_uploads.md](./05_uploads.md) | 3-step upload flow · Presign → B2 → Confirm · Multipart |
| [06_shares.md](./06_shares.md) | Share links · Token access · Image proxy · Public endpoints |
| [07_endpoints_reference.md](./07_endpoints_reference.md) | Complete endpoint reference (all methods, bodies, responses) |
| [08_data_models.md](./08_data_models.md) | Firestore schemas · Security rules · Field name standards |
| [09_best_practices.md](./09_best_practices.md) | Anti-patterns · Integration checklist · Common mistakes |

---

## Key Facts (Quick Reference)

**Collections:** `files` (unified files+folders) · `shares` · `uploadSessions` · `users`

**NOT a separate `folders` collection.** Folders live in `files` with `type: "folder"`.

**Storage field:** `bucketKey` (never `b2Key`, `objectKey`, etc.)

**Quota field:** `planQuotaBytes` (never `quotaBytes`)

**Share active field:** `isActive` (write) · also read `isPublic` for legacy compat

**Auth:** `Authorization: Bearer <firebase-id-token>` on all protected endpoints

**Backend prefix:** Most endpoints are at `BACKEND_URL/v1/...`
Exception: `users/initialize` and `users/profile` → `BACKEND_URL/api/...`

**Endpoints without Next.js proxy:**
- `POST /v1/files/restore`
- `POST /v1/files/permanent-delete` (single file)
- `GET /v1/shares/` (list user shares)

---

## What's New in v3

- Single authoritative endpoint reference (no more duplication across 5 files)
- Legacy `folders` collection fully removed from documentation
- All field names standardized (`bucketKey`, `planQuotaBytes`, `isActive`)
- Upload flow documented with multipart support
- Image proxy vs download endpoint distinction clearly explained
- Anti-patterns and integration checklists added
- Zero frontend content
- Consistent multi-tenant framing throughout
