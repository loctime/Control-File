# Estructura de Documentación docs_v2

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

Jerarquía mental para IA/agentes:

1️⃣ **TRUTH** (ley suprema)  
2️⃣ **PRINCIPIOS** (cómo pensar)  
3️⃣ **CONTRATOS TÉCNICOS** (datos, flujos, endpoints)  
4️⃣ **EXCEPCIONES / LEGACY**

---

## Estructura de archivos

```
/docs_v2
│
├── TRUTH.md                     ← ÚNICO, plano, manda
│
├── 01_INTRO.md                  ← Opcional, humano / contexto
│
├── 02_FILOSOFIA_Y_PRINCIPIOS.md ← IA-first (reglas operativas)
│
├── 03_CONTRATOS_TECNICOS/       ← Contratos derivados de TRUTH
│   ├── modelo_files.md
│   ├── modelo_shares.md
│   ├── modelo_uploadSessions.md
│   ├── endpoints_shares.md
│   └── firestore_rules.md
│
├── 04_FLUJOS_EJECUTABLES/       ← Flujos paso a paso
│   ├── upload.md
│   ├── share_publico.md
│   └── proxy_imagenes.md
│
├── 05_DECISIONES_Y_NO_DECISIONES/
│   ├── por_que_controlfile.md
│   └── decisiones_descartadas.md
│
├── 06_LEGACY_Y_EXCEPCIONES/     ← Excepciones documentadas
│   ├── isPublic.md
│   ├── folders_legacy.md
│   └── migraciones.md
│
└── 99_GLOSARIO.md               ← Términos y conceptos
```

---

## Regla fundamental

**Los subdocs no inventan nada, solo derivan de TRUTH.md.**

Cada documento debe referenciar explícitamente:
- Sección de TRUTH.md de la que deriva
- Otros documentos relacionados

---

## Jerarquía de autoridad

1. **TRUTH.md** - Fuente única de verdad técnica
2. **02_FILOSOFIA_Y_PRINCIPIOS.md** - Interpretación operativa de TRUTH
3. **03_CONTRATOS_TECNICOS/** - Especificaciones técnicas derivadas
4. **04_FLUJOS_EJECUTABLES/** - Flujos paso a paso derivados
5. **05_DECISIONES_Y_NO_DECISIONES/** - Contexto y decisiones
6. **06_LEGACY_Y_EXCEPCIONES/** - Excepciones y compatibilidad
7. **99_GLOSARIO.md** - Referencia rápida

---

## Uso para IA/agentes

1. Leer TRUTH.md primero
2. Consultar 02_FILOSOFIA_Y_PRINCIPIOS.md para reglas operativas
3. Usar contratos técnicos para especificaciones detalladas
4. Seguir flujos ejecutables para operaciones paso a paso
5. Revisar legacy/excepciones antes de cambios

---

## Documentos legacy (no usar)

- `CONTROLFILESYSTEM.md` - Contenido distribuido en nuevos documentos
- `VALIDACION_FILOSOFIA.md` - Temporal, puede eliminarse
