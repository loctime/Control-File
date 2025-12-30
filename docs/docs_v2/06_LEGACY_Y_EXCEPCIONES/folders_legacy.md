# Legacy: Regla Firestore `folders`

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §5.1

---

## Estado

Regla existe en `firestore-rules/controlFile.rules` pero **NO se usa**.

---

## Regla legacy

```javascript
match /folders/{folderId} {
  allow create: if isAuth() && request.resource.data.userId == uid();
  allow read, update, delete: if isAuth() && resource.data.userId == uid();
}
```

---

## Realidad actual

Las carpetas están en la colección `files` con `type: "folder"`.

**No crear documentos en colección `folders`.**

---

## Razón de existencia

Probablemente restos de arquitectura anterior.  
Se mantiene en rules por compatibilidad pero no se usa.

---

## Referencias

- TRUTH.md §5.1
- 02_FILOSOFIA_Y_PRINCIPIOS.md §2.1, §8.1
- 03_CONTRATOS_TECNICOS/firestore_rules.md

