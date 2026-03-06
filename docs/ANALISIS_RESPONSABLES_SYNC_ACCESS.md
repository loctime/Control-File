# Análisis: Responsables de vehículos y sincronización de accesos (emails)

## 1. Qué campo usa `syncAccessUsers` para la lista de usuarios activos

**Respuesta: usa AMBOS, unidos (unión).**

En `backend/src/modules/emailUsers/emailUsers.service.js`, dentro de `syncAccessUsers()` (aprox. líneas 200-213):

```javascript
const rawResponsables = Array.isArray(data.responsables) ? data.responsables : [];
const storedNormalized = Array.isArray(data.responsablesNormalized) ? data.responsablesNormalized : [];
const normalizedFromRaw = normalizeEmailArray(rawResponsables);
const normalizedStored = normalizeEmailArray(storedNormalized);
const mergedSet = new Set([...normalizedFromRaw, ...normalizedStored]);
const merged = Array.from(mergedSet);
merged.forEach((email) => allEmailsSet.add(email));
```

- La lista de “quién debe tener acceso” se arma con la **unión** de:
  - `normalizedFromRaw` = normalización de `responsables`
  - `normalizedStored` = normalización de `responsablesNormalized`
- Cualquier email que esté en **cualquiera** de los dos se considera activo.
- Por eso `hys@ma2ia.com.ar` sigue activo: aunque ya no está en `responsables`, sigue en `responsablesNormalized`, y el merge lo incluye en `allEmailsSet`.

---

## 2. ¿`responsablesNormalized` tiene prioridad sobre `responsables`?

No hay “prioridad” de uno sobre el otro: se **combinan**.  
En la práctica, `responsablesNormalized` puede **mantener** accesos que ya no están en `responsables`, porque:

- Si un email está solo en `responsablesNormalized`, entra en `merged` y en `allEmailsSet`.
- Luego (líneas 215-221), cuando se “corrige” el vehículo, se escribe `responsablesNormalized: merged`, es decir se **vuelve a guardar esa unión**. Así, los emails que solo estaban en `responsablesNormalized` **nunca se eliminan** de ese array.

---

## 3. Lugares donde se usa `responsablesNormalized`

| Archivo | Uso |
|--------|-----|
| **emailUsers.service.js** | `getMyVehicles`: consulta con `responsablesNormalized` (array-contains); fallback a `responsables` si la query está vacía. |
| **emailUsers.service.js** | `syncAccessUsers`: lee ambos, hace merge y escribe `responsablesNormalized = merged`. |
| **admin.js** | PATCH `/vehicle-alerts`: escribe `responsables` y `responsablesNormalized = normalizeEmailArray(responsables)`. |
| **vehicleEventService.js** | `upsertDailyAlertBatch`: usa `vehicle.responsables` del evento, calcula `responsablesNormalized` en memoria y escribe en **dailyAlerts** (otra colección). No escribe en `apps/emails/vehicles`. |
| **emailAlerts.js** (mark sent) | Al marcar alertas enviadas, toma responsables de `vehicleData.responsablesNormalized` si existe y tiene longitud > 0, si no `vehicleData.responsables`. |
| **emailAlerts.service.js** | `getMyRiskByVehicle`: consulta vehículos con `VEHICLES_REF.where("responsablesNormalized", "array-contains", normalized)`. Solo usa `responsablesNormalized`. |
| **emailAlerts.service.js** | Listado de campos (línea 225): incluye `"responsablesNormalized"` en la proyección. |

---

## 4. ¿`responsablesNormalized` se actualiza automáticamente cuando cambia `responsables`?

**Solo en algunos flujos:**

- **PATCH /api/admin/vehicle-alerts**: sí. Actualiza `responsables` y `responsablesNormalized = normalizeEmailArray(responsables)` en la misma escritura.
- **syncAccessUsers**: no “sigue” a `responsables`. Recalcula `merged = raw ∪ stored` y escribe `responsablesNormalized = merged`. Así, si en BD `responsables` tiene menos emails que `responsablesNormalized`, el merge **mantiene** los que solo están en `responsablesNormalized` y los vuelve a persistir. No hay actualización automática que “reduzca” `responsablesNormalized` al contenido actual de `responsables`.

Si `responsables` se cambia por otro medio (consola Firestore, otro cliente, script) sin tocar `responsablesNormalized`, nadie lo recalcula a partir solo de `responsables`.

---

## 5. Flujos que actualizan `responsables` sin recalcular `responsablesNormalized`

- **Backend**: el único punto que escribe `responsables` en `apps/emails/vehicles` es el PATCH de admin, y ahí sí se recalcula y escribe `responsablesNormalized`.
- Por tanto, la desincronización puede venir de:
  - Edición directa en Firestore (solo `responsables`).
  - Versión antigua del backend que solo escribía `responsables`.
  - Cualquier otro cliente/script que actualice solo `responsables`.

Además, **syncAccessUsers** no usa `responsables` como única fuente de verdad: al hacer merge y escribir `merged` en `responsablesNormalized`, puede **perpetuar** un valor antiguo que ya no está en `responsables`.

---

## 6. ¿Eliminar `responsablesNormalized` y recalcularlo dinámicamente?

- **No eliminar el campo**: las consultas por responsable (`getMyVehicles`, `getMyRiskByVehicle`) usan `array-contains` sobre un array en el documento; Firestore no permite filtrar por “email en array normalizado calculado on-the-fly”. Por tanto hace falta un array almacenado (normalizado) para índices y queries.
- **Sí recalcularlo siempre desde `responsables`**:  
  `responsablesNormalized` debe ser **siempre** `normalizeEmailArray(responsables)` y no un superset. Así se evita que queden emails “fantasma” que sigan dando acceso.

---

## 7. Solución más robusta

- **Fuente de verdad**: solo `responsables`.
- **Regla**: en todo el sistema, `responsablesNormalized` debe ser exactamente `normalizeEmailArray(responsables)`:
  - Al construir la lista de usuarios con acceso (en `syncAccessUsers`).
  - Al escribir en `apps/emails/vehicles`: cada vez que se escribe `responsables`, escribir también `responsablesNormalized = normalizeEmailArray(responsables)`.
- En `syncAccessUsers`:
  - Para cada vehículo, considerar “activos” solo los emails de `normalizeEmailArray(responsables)`.
  - Al actualizar el documento del vehículo, escribir `responsablesNormalized = normalizeEmailArray(responsables)` (sin merge con el valor almacenado). Así se corrige cualquier valor obsoleto.

---

## 8. ¿`syncAccessUsers` debe desactivar usuarios que ya no aparecen en ningún vehículo?

**Sí, y ya lo hace** (paso 5, líneas 347-366): recorre los usuarios existentes en `apps/emails/access` y, si el email no está en `allEmailsSet`, hace `active: false` y `enabled: false`.

El problema es que `allEmailsSet` hoy se arma con la unión de `responsables` y `responsablesNormalized`. Mientras un email siga en `responsablesNormalized` (aunque ya no en `responsables`), seguirá en `allEmailsSet` y **no** se desactivará.  
Si se cambia la construcción de `allEmailsSet` para usar **solo** `responsables` (y los recipients de config), entonces los usuarios que ya no estén en ningún vehículo ni en config quedarán correctamente con `active=false`.

---

## Diagnóstico resumido

| Punto | Conclusión |
|-------|------------|
| Campo usado por `syncAccessUsers` para “activos” | Unión de `responsables` y `responsablesNormalized`. |
| Prioridad | No hay prioridad; el merge hace que lo que solo está en `responsablesNormalized` siga contando. |
| Actualización automática de `responsablesNormalized` | No; syncAccessUsers además refuerza el merge y no quita emails obsoletos. |
| Origen de la inconsistencia | Merge en syncAccessUsers + posible escritura previa solo de `responsables` o edición manual. |
| Desactivar usuarios que ya no están en ningún vehículo | Ya está implementado; dejará de fallar cuando la lista de “activos” se base solo en `responsables` (y config). |

---

## Riesgos del diseño actual

1. **Acceso indebido**: Emails que ya no son responsables siguen en `responsablesNormalized` y siguen considerados activos y viendo vehículos.
2. **Inconsistencia estable**: Cada ejecución de `syncAccessUsers` reescribe `responsablesNormalized = merged`, por lo que no se “limpia” el array.
3. **Dependencia de un único flujo**: Solo el PATCH de admin garantiza coherencia; cualquier otro escritor de `responsables` puede dejar `responsablesNormalized` desactualizado.
4. **Consultas que priorizan Normalized**: Quienes leen `responsablesNormalized` (p. ej. `getMyRiskByVehicle`) pueden devolver datos que no coinciden con `responsables`.

---

## Cambios mínimos recomendados

1. **En `syncAccessUsers`** (`emailUsers.service.js`):
   - Para cada vehículo, usar **solo** `rawResponsables` como fuente de responsables:
     - `canonicalNormalized = normalizeEmailArray(rawResponsables)`.
     - Añadir a `allEmailsSet` solo los emails de `canonicalNormalized`.
   - Al escribir en el vehículo, guardar `responsablesNormalized: canonicalNormalized` (no `merged`). Así se corrige el estado ya desincronizado.

2. **Mantener** el paso 5 que desactiva usuarios que no están en `allEmailsSet`; con el cambio anterior, `allEmailsSet` reflejará solo responsables y config, y esos usuarios quedarán correctamente con `active=false`.

---

## Cambios estructurales recomendados

1. **Documentar** en código y/o en docs que `responsablesNormalized` es siempre derivado: `responsablesNormalized = normalizeEmailArray(responsables)` y no debe escribirse por separado con lógica distinta.
2. **Centralizar** la escritura de vehículos en `apps/emails/vehicles`: que un único módulo/servicio sea el que, al guardar `responsables`, calcule y guarde también `responsablesNormalized`.
3. **Lecturas**: donde hoy se use `responsablesNormalized` con fallback a `responsables`, seguir usando `responsablesNormalized` para las queries (por índices), pero tener claro que tras el fix ese campo será siempre coherente con `responsables`.
4. **Opcional**: en el PATCH de admin, seguir escribiendo ambos campos; si más adelante se añade otro endpoint o script que actualice `responsables`, reutilizar la misma regla (siempre escribir `responsablesNormalized = normalizeEmailArray(responsables)`).

Con estos cambios se elimina la inconsistencia que mantiene a `hys@ma2ia.com.ar` activo y se asegura que solo los responsables actuales (y los de config) tengan acceso, y que los que dejan de serlo reciban `active=false` en la siguiente sincronización.
