# Documentación ControlFile v2

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

Documentación técnica organizada para IA/agentes y desarrolladores.

---

## Jerarquía de autoridad

### 1️⃣ TRUTH.md
**Ley suprema.** Fuente única de verdad técnica.  
Define qué existe, qué no existe, qué es obligatorio.

**Prioridad:** Máxima. Si algo contradice TRUTH.md, TRUTH.md tiene razón.

---

### 2️⃣ 02_FILOSOFIA_Y_PRINCIPIOS.md
**Cómo pensar.** Reglas operativas derivadas de TRUTH.md.  
Evita decisiones incorrectas, inventos y regresiones.

**Uso:** Consultar antes de cualquier cambio o implementación.

---

### 3️⃣ 03_CONTRATOS_TECNICOS/
**Especificaciones técnicas.** Contratos derivados de TRUTH.md.

- `modelo_files.md` - Colección `files` (archivos y carpetas)
- `modelo_shares.md` - Colección `shares`
- `modelo_uploadSessions.md` - Colección `uploadSessions`
- `endpoints_shares.md` - Endpoints de shares
- `firestore_rules.md` - Reglas de Firestore

**Uso:** Referencia rápida para modelos de datos y endpoints.

---

### 4️⃣ 04_FLUJOS_EJECUTABLES/
**Flujos paso a paso.** Secuencias de operaciones derivadas de TRUTH.md.

- `upload.md` - Flujo completo de upload
- `share_publico.md` - Acceso a shares públicos
- `proxy_imagenes.md` - Proxy CORS-safe para imágenes

**Uso:** Implementar operaciones siguiendo estos flujos.

---

### 5️⃣ 05_DECISIONES_Y_NO_DECISIONES/
**Contexto y decisiones.** Por qué existe ControlFile y qué se descartó.

- `por_que_controlfile.md` - Propósito y problema que resuelve
- `decisiones_descartadas.md` - Decisiones arquitectónicas NO tomadas

**Uso:** Entender contexto y evitar repetir decisiones descartadas.

---

### 6️⃣ 06_LEGACY_Y_EXCEPCIONES/
**Excepciones documentadas.** Compatibilidad y migraciones.

- `isPublic.md` - Campo legacy en shares
- `folders_legacy.md` - Regla Firestore no usada
- `migraciones.md` - Cambios de esquema históricos

**Uso:** Manejar retrocompatibilidad y excepciones.

---

### 7️⃣ 99_GLOSARIO.md
**Referencia rápida.** Términos técnicos y conceptos clave.

**Uso:** Consulta rápida de términos.

---

## Regla fundamental

**Los subdocs no inventan nada, solo derivan de TRUTH.md.**

Cada documento debe:
- Referenciar explícitamente TRUTH.md
- No agregar información no documentada en TRUTH.md
- Ser autocontenido pero derivado

---

## Para IA/agentes

1. **Leer TRUTH.md primero** - Entender qué existe
2. **Consultar 02_FILOSOFIA_Y_PRINCIPIOS.md** - Entender cómo pensar
3. **Usar contratos técnicos** - Especificaciones detalladas
4. **Seguir flujos ejecutables** - Operaciones paso a paso
5. **Revisar legacy/excepciones** - Antes de cambios

---

## Para desarrolladores humanos

- `01_INTRO.md` - Contexto y visión general
- Contratos técnicos - Referencia rápida
- Flujos ejecutables - Guías paso a paso
- Glosario - Términos técnicos

