# ControlFile – Architecture Status

## ⚠️ IMPORTANT ARCHITECTURE NOTICE ⚠️

**ControlFile architecture is currently FROZEN.**

## Current Decision (2026-01)

- **Express (Render) is the ONLY official backend of ControlFile.**
- **Next.js must be treated as frontend only.**

## Rules

### ❌ DO NOT create new Route Handlers in Next.js that:
- Access Firestore Admin
- Access Backblaze B2
- Implement business logic
- Duplicate existing Express APIs

### ✅ If backend functionality is required, ALWAYS:
- Add it to Express
- Or call existing Express endpoints

### 🔒 Existing duplicated APIs in Next.js:
- Are intentionally kept
- Must NOT be extended or modified

## Enforcement

**If a request would violate this rule, STOP and warn the user instead.**

---

Migration will be done AFTER frontend/backend repository separation.

This decision is intentional and temporary.
