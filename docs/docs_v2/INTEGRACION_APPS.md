# ControlFile – Integración de Apps Externas

⚠️ Este documento NO define comportamiento.
Deriva estrictamente de TRUTH.md.
Ante contradicción, TRUTH.md manda.

---

## 1. Qué es este documento

Este documento define el **alcance exacto** de lo que una app externa puede y debe usar al integrarse con ControlFile.

**Autoridad:** ControlFile es la autoridad. La app externa es cliente.

**Alcance:** Este documento lista únicamente endpoints, modelos y flujos permitidos para apps externas. Todo lo demás está fuera de alcance.

**Regla fundamental:** Si algo no está explícitamente permitido aquí, no debe usarse.

---

## Nota sobre apps first-party

Algunas aplicaciones del ecosistema Control* (por ejemplo ControlAudit) pueden operar bajo un modelo de integración privilegiada first-party.

Estas aplicaciones:
- no siguen el contrato mínimo definido en este documento
- utilizan APIs internas de ControlFile
- operan bajo reglas específicas y controladas

Este documento NO aplica a integraciones first-party privilegiadas. Define únicamente el contrato mínimo garantizado para integraciones estándar.

---

## 2. Documentos obligatorios (lectura requerida)

### TRUTH.md

**Fuente suprema.** Lectura completa obligatoria antes de integrar.

Define:
- Qué existe y qué no existe
- Modelos de datos exactos
- Endpoints disponibles
- Reglas de seguridad

**Prioridad:** Máxima. Si algo contradice TRUTH.md, TRUTH.md tiene razón.

**Referencia:** `docs/docs_v2/TRUTH.md`

---

### 02_FILOSOFIA_Y_PRINCIPIOS.md

**Cómo pensar la integración.** Reglas operativas para evitar decisiones incorrectas.

Define:
- Qué NO debe hacer una app externa
- Antipatrones comunes
- Principios de separación de responsabilidades

**Uso:** Consultar antes de implementar cualquier integración.

**Referencia:** `docs/docs_v2/02_FILOSOFIA_Y_PRINCIPIOS.md`

---

## 3. Contratos técnicos permitidos

Estos documentos definen contratos técnicos que una app externa puede usar.

### 03_CONTRATOS_TECNICOS/modelo_files.md

**Modelo de datos de la colección `files`.**

Define:
- Campos obligatorios y opcionales
- Diferenciación `type: "file" | "folder"`
- Reglas de ownership (`userId`)

**Uso:** Entender estructura de datos al crear referencias o leer metadatos.

**Referencia:** `docs/docs_v2/03_CONTRATOS_TECNICOS/modelo_files.md`

---

### 03_CONTRATOS_TECNICOS/modelo_uploadSessions.md

**Modelo de datos de sesiones de upload.**

Define:
- Campos obligatorios y opcionales
- Estados de sesión (`pending`, `uploaded`, `completed`)
- Validación de cuota

**Uso:** Entender flujo de upload y estados de sesión.

**Referencia:** `docs/docs_v2/03_CONTRATOS_TECNICOS/modelo_uploadSessions.md`

---

### 03_CONTRATOS_TECNICOS/endpoints_shares.md

**Endpoints de shares públicos y protegidos.**

Define:
- Endpoints protegidos (crear, revocar, listar)
- Endpoints públicos (info, download, image proxy)
- Validaciones y efectos

**Uso:** Implementar funcionalidad de compartir archivos.

**Referencia:** `docs/docs_v2/03_CONTRATOS_TECNICOS/endpoints_shares.md`

---

**Nota:** Otros contratos técnicos existen (`endpoints_files.md`, `firestore_rules.md`, `modelo_shares.md`) pero **NO son para uso directo de apps externas**. Son documentación interna de ControlFile.

---

## 4. Flujos ejecutables soportados

Estos flujos definen secuencias de operaciones permitidas para apps externas.

### Upload de archivo

**Fuente:** `04_FLUJOS_EJECUTABLES/upload.md`

**Secuencia obligatoria:**
1. Crear sesión: `POST /api/uploads/presign`
2. Upload directo a B2: `PUT {presignedUrl}` (cliente → B2)
3. Confirmar upload: `POST /api/uploads/confirm`

**Reglas:**
- Siempre pasa por `uploadSession`
- Validación de cuota ANTES de presign
- Upload directo a B2 (no pasa por backend)
- Confirmación obligatoria para crear documento en `files`

**Referencia:** TRUTH.md §8.1

---

### Share público

**Fuente:** `04_FLUJOS_EJECUTABLES/share_publico.md`, `04_FLUJOS_EJECUTABLES/proxy_imagenes.md`

**Flujos soportados:**

#### Crear share
1. App autenticada: `POST /api/shares/create`
2. Backend genera token aleatorio
3. Backend crea documento en `shares/{token}`
4. App recibe `shareToken` y `shareUrl`

#### Acceder a share público
1. Público: `GET /api/shares/{token}` (info)
2. Público: `POST /api/shares/{token}/download` (descarga)
3. Público: `GET /api/shares/{token}/image` (proxy CORS-safe)

**Reglas:**
- Orden del flujo es obligatorio
- Validaciones estrictas en cada paso
- Proxy de imagen es stream directo (no presigned URL)

**Referencia:** TRUTH.md §7, §8.2, §8.3, §8.4

---

## 5. Qué NO debe usar una app externa (explícito)

### Endpoints de Files (core de ControlFile)

**NO usar:**
- `POST /api/files/restore`
- `POST /api/files/permanent-delete`
- `POST /api/files/zip`
- `POST /api/files/empty-trash`

**Razón:** Estos endpoints son core de ControlFile y no están pensados para uso directo por apps externas (TRUTH.md §6).

---

### Firestore Rules

**NO usar:**
- `03_CONTRATOS_TECNICOS/firestore_rules.md`

**Razón:** Las reglas de Firestore son configuración interna de ControlFile. Las apps externas no deben depender de ellas ni intentar leerlas directamente.

---

### Legacy y excepciones

**NO usar:**
- `06_LEGACY_Y_EXCEPCIONES/` (cualquier documento)

**Razón:** Documentación de compatibilidad y migraciones internas. No aplica a apps externas.

---

### Documentos de decisiones internas

**NO usar:**
- `05_DECISIONES_Y_NO_DECISIONES/` (cualquier documento)

**Razón:** Documentación de contexto interno y decisiones arquitectónicas. No define comportamiento para apps externas.

---

### Endpoints no documentados en TRUTH.md

**NO usar:**
- Cualquier endpoint que no esté explícitamente documentado en TRUTH.md §6 o §7

**Razón:** Si no está en TRUTH.md, se considera no soportado, no implementado o fuera de alcance (TRUTH.md líneas 12-15).

---

## 6. Antipatrones comunes (NO hacer)

### Generar presigned URLs desde la app

**Antipatrón:** La app genera presigned URL directo contra B2.

**Correcto:** Usar `POST /api/uploads/presign` y `POST /api/shares/{token}/download`.

**Referencia:** TRUTH.md §1, §3.3; 02_FILOSOFIA_Y_PRINCIPIOS.md §1.1

---

### Acceder directamente a B2

**Antipatrón:** La app accede directamente a Backblaze B2 sin pasar por ControlFile.

**Correcto:** Todos los accesos a archivos pasan por endpoints de ControlFile.

**Referencia:** TRUTH.md §1, §3.3; 02_FILOSOFIA_Y_PRINCIPIOS.md §1.1

---

### Inventar campos en files o shares

**Antipatrón:** La app crea documentos en `files` o `shares` con campos no documentados en TRUTH.md.

**Correcto:** Usar únicamente campos definidos en TRUTH.md §4.1, §4.2.

**Referencia:** TRUTH.md §4; 02_FILOSOFIA_Y_PRINCIPIOS.md §6.1

---

### Usar endpoints core de ControlFile

**Antipatrón:** La app usa endpoints de `files` (restore, zip, permanent-delete, empty-trash).

**Correcto:** Usar únicamente endpoints de `shares` y `uploads`.

**Referencia:** TRUTH.md §6

---

### Asumir comportamiento no documentado

**Antipatrón:** La app asume que un endpoint o campo funciona de cierta manera sin verificar en TRUTH.md.

**Correcto:** Verificar en TRUTH.md antes de usar cualquier endpoint o campo.

**Referencia:** TRUTH.md líneas 12-15

---

## 7. Checklist de integración

Antes de considerar la integración completa, verificar:

- [ ] Lectura completa de TRUTH.md
- [ ] Lectura de 02_FILOSOFIA_Y_PRINCIPIOS.md
- [ ] Autenticación con Firebase Auth (token JWT)
- [ ] Uso exclusivo de endpoints documentados en TRUTH.md §7 (shares) y uploads
- [ ] Upload vía `uploadSession` (presign → upload → confirm)
- [ ] Shares vía ControlFile (crear, acceder, descargar)
- [ ] Sin acceso directo a storage (B2)
- [ ] Sin generación de presigned URLs desde la app
- [ ] Sin uso de endpoints core de ControlFile (`/api/files/*`)
- [ ] Sin campos inventados en `files` o `shares`
- [ ] Validación de cuota antes de upload (manejada por ControlFile)

---

## 8. Regla final de autoridad

**Ante cualquier contradicción o duda, TRUTH.md manda.**

Si este documento, cualquier otro documento derivado, o el código parecen contradecir TRUTH.md, TRUTH.md tiene razón.

TRUTH.md es la fuente única de verdad técnica y tiene prioridad sobre cualquier README, comentario o implementación parcial.

---

## Referencias

- TRUTH.md - Fuente única de verdad técnica
- 02_FILOSOFIA_Y_PRINCIPIOS.md - Principios operativos
- 03_CONTRATOS_TECNICOS/modelo_files.md - Modelo de datos files
- 03_CONTRATOS_TECNICOS/modelo_uploadSessions.md - Modelo de sesiones
- 03_CONTRATOS_TECNICOS/endpoints_shares.md - Endpoints de shares
- 04_FLUJOS_EJECUTABLES/upload.md - Flujo de upload
- 04_FLUJOS_EJECUTABLES/share_publico.md - Flujo de shares públicos
- 04_FLUJOS_EJECUTABLES/proxy_imagenes.md - Flujo de proxy de imágenes

