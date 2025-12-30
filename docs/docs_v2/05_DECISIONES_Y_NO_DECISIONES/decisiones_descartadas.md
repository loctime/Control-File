# Decisiones Descartadas

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

Decisiones arquitectónicas que **NO** se tomaron y por qué.

---

## No usar colección `folders` separada

**Decisión:** Archivos y carpetas en misma colección `files` con `type`.

**Razón:** Simplifica queries, permite tratar ambos como "items" en UI.

**Estado:** Regla `folders` existe en Firestore Rules pero NO se usa (legacy).

---

## No almacenar presigned URLs en Firestore

**Decisión:** Generar presigned URLs bajo demanda, nunca persistirlas.

**Razón:** URLs efímeras (5min-1h) minimizan ventana de acceso no autorizado.

**Estado:** Implementado. URLs se generan y descartan inmediatamente.

---

## No hacer uploads pasando por backend

**Decisión:** Uploads directos a B2 usando presigned URLs.

**Razón:** Mejor rendimiento, menor costo, backend no maneja archivos grandes.

**Estado:** Implementado. Backend solo genera URLs, cliente sube directamente.

---

## No usar presigned URLs para imágenes CORS

**Decisión:** Proxy stream directo desde B2 para imágenes.

**Razón:** Headers CORS solo se pueden configurar en proxy backend, no en presigned URLs.

**Estado:** Implementado en `/api/shares/{token}/image`.

---

## No eliminar físicamente archivos por defecto

**Decisión:** Soft delete con `deletedAt`, eliminación física solo con endpoint explícito.

**Razón:** Recuperación posible, auditoría, historial.

**Estado:** Implementado. `POST /api/files/permanent-delete` requiere archivo en papelera.

---

## No validar cuota después de upload

**Decisión:** Validar cuota ANTES de generar presigned URL.

**Razón:** Evitar uploads que luego no se puedan confirmar.

**Estado:** Implementado. Validación en `POST /api/uploads/presign`.

---

## Referencias

- TRUTH.md §3.3, §4.1, §8.1
- 02_FILOSOFIA_Y_PRINCIPIOS.md §2.1, §3.2, §3.3, §5.1, §7.2

