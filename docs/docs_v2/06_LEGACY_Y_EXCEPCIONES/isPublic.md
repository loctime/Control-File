# Legacy: Campo `isPublic` en Shares

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

**Fuente:** TRUTH.md §4.2

---

## Estado

Campo legacy en colección `shares`.  
Retrocompatible con `isActive`.

---

## Comportamiento

### Lectura (retrocompatible)

Validación de share activo:
```javascript
if (shareData.isActive === false || shareData.isPublic === false) {
  // Share revocado
}
```

**Regla:** Si `isPublic` es `undefined`, se trata como válido. Solo `false` revoca.

---

### Escritura (moderna)

**NO crear nuevos shares con `isPublic`.**

Solo usar `isActive`:
```javascript
{
  isActive: true,
  // NO incluir isPublic
}
```

---

## Migración

Shares existentes con `isPublic`:
- Se leen correctamente (retrocompatibilidad)
- No se actualizan automáticamente
- Nuevos shares no incluyen `isPublic`

---

## Referencias

- TRUTH.md §4.2
- 02_FILOSOFIA_Y_PRINCIPIOS.md §6.2
- 03_CONTRATOS_TECNICOS/modelo_shares.md

