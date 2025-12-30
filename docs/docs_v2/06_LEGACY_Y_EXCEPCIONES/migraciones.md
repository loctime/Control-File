# Migraciones y Cambios de Esquema

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

Cambios históricos en el modelo de datos.

---

## Campo `type` en `files`

**Estado:** Obligatorio según TRUTH.md.

**Realidad código:** Al crear archivo desde upload, `type` no se establece explícitamente.

**Política actual:** Queries fuerzan `type: 'file'` si falta (compatibilidad).

**Recomendación:** Establecer `type` explícitamente al crear documentos.

---

## Campo `path` en archivos

**Estado:** Obligatorio según TRUTH.md.

**Realidad código:** Al crear archivo desde upload, `path` no se establece.

**Comportamiento:** Se calcula en otros lugares (folders) pero no en uploads.

**Recomendación:** Calcular `path` al crear archivo o marcarlo como opcional.

---

## Referencias

- TRUTH.md §4.1
- VALIDACION_FILOSOFIA.md (observaciones pendientes)

