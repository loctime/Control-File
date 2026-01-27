TRUTH — ControlFile vNext

Documento normativo del sistema

0. Propósito del documento

Este TRUTH define qué es ControlFile, qué responsabilidades asume, qué dominios son canónicos y qué comportamientos son válidos.

Todo diseño, código, endpoint o integración futura debe:

alinearse con este documento, o

declararse explícitamente como legacy / excepción.

1. Identidad del sistema
1.1 Qué es ControlFile

ControlFile es el backend central multi-app de la plataforma.

ControlFile provee infraestructura común a todas las apps del ecosistema, incluyendo:

almacenamiento masivo de archivos,

coordinación de archivos entre apps,

identidad y autenticación,

metadata persistente,

lógica de backend compartida,

control de cuotas y permisos,

mecanismos de compartición (shares).

ControlFile no es una app.
ControlFile no es solo un filesystem.
ControlFile es infraestructura de plataforma.

1.2 Qué NO es ControlFile

ControlFile:

❌ no es un frontend,

❌ no implementa lógica de negocio específica de una app,

❌ no es responsable de UI,

❌ no es un repositorio de datos arbitrarios sin semántica.

2. Arquitectura conceptual
2.1 Capas principales

ControlFile se estructura en los siguientes dominios conceptuales:

Identidad

Usuarios

Autenticación

Permisos

Relación usuario ↔ cuenta

Cuentas (Accounts)

Plan

Límites

Estado

Cuotas

Billing (actual o futuro)

Filesystem lógico

Dominio files

Carpetas

Paths

Ancestors

Visibilidad

Storage físico

Backblaze B2

Buckets

Objetos

Multipart uploads

Integraciones / Ingestión

Entradas externas

Legacy

Importaciones

Automatismos

Servicios transversales

Shares

Cache

Observabilidad

Health / diagnostics

3. Dominio Filesystem (files)
3.1 Rol del dominio files

files es el modelo canónico del filesystem lógico compartido por las apps.

Representa:

archivos y carpetas visibles para usuarios/apps,

con semántica de árbol,

con permisos,

con paths estables.

3.2 Qué entra en files

Solo entran en files aquellos artefactos que:

forman parte del filesystem visible,

deben navegarse como árbol,

tienen path y ancestors,

están sujetos a reglas de visibilidad.

3.3 Qué NO entra en files

No deben almacenarse en files:

ingestiones externas sin semántica de filesystem,

archivos temporales,

caches,

outputs internos de procesos,

artefactos técnicos de integraciones.

Estos deben usar dominios separados.

3.4 Modelo obligatorio de files

Todo documento en files debe incluir, como mínimo:

type (file | folder)

path

ancestors

visibility

owner / accountId

metadata de auditoría

Cualquier documento que no cumpla este contrato:

no pertenece al dominio files.

4. Uploads
4.1 Pipeline canónico de uploads

El único pipeline canónico para el filesystem es:

presign → upload directo a storage → confirmación


Este pipeline:

valida permisos,

valida cuota,

asegura consistencia,

desacopla backend de transferencia pesada.

4.2 Uploads externos

Los uploads externos:

no forman parte del filesystem canónico, salvo conversión explícita,

existen para integración, legacy o ingestión controlada.

Regla fundamental:

Ningún upload externo debe escribir directamente en files.

5. Cuotas y límites
5.1 Dónde vive la cuota

La cuota es propiedad de la cuenta, no del usuario.

accounts define:

límites de storage,

plan,

estado.

Usuarios:

no tienen cuota propia,

no gestionan storage individualmente.

5.2 Principio de control

Toda validación de cuota:

se evalúa a nivel cuenta,

se implementa de forma consistente,

no se replica en múltiples modelos.

6. Identidad y usuarios
6.1 Rol de users

users representa identidad y permisos.

Incluye:

identidad autenticada,

relación con cuentas,

roles y capacidades.

No incluye:

billing,

planes,

cuotas.

7. Shares
7.1 Naturaleza de los shares

Los shares:

son accesos públicos controlados,

siempre refieren a recursos existentes,

tienen expiración, estado y auditoría.

7.2 Principio de seguridad

Todo token público:

debe ser criptográficamente seguro,

debe ser revocable,

debe ser observable (métricas).

8. Legacy y excepciones
8.1 Principio de legacy consciente

El sistema puede contener legacy, pero:

debe estar documentado,

debe estar aislado,

no debe contaminar dominios canónicos.

Legacy no define el TRUTH.

9. Evolución del sistema
9.1 Relación TRUTH ↔ código

Este TRUTH:

puede contradecir el código actual,

define el objetivo de alineación,

habilita deuda técnica consciente.

El código debe evolucionar hacia este TRUTH, no al revés.

10. Regla final

Si algo no está definido en este TRUTH,
no forma parte del sistema canónico.

Puede existir,
pero no es contractual.