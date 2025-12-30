# Por qué ControlFile existe

⚠️ **Este documento NO define comportamiento. Deriva estrictamente de TRUTH.md. Ante contradicción, TRUTH.md manda.**

---

**Fuente:** TRUTH.md §1

---

## Problema que resuelve

Aplicaciones modernas suelen tener:
- URLs presignadas expuestas
- Lógica de seguridad duplicada
- Problemas de CORS entre dominios
- Dependencias fuertes al proveedor de storage
- Dificultad para auditar accesos
- Bugs inconsistentes entre apps

---

## Solución: Infraestructura centralizada

ControlFile resuelve estos problemas **una sola vez**, de forma centralizada.

---

## Qué NO gestionan las apps

- URLs presignadas
- CORS
- Permisos públicos
- Acceso directo al storage

---

## Qué gestiona ControlFile

- Abstracción del storage real
- Seguridad y permisos centralizados
- Flujos unificados de subida, descarga y share
- Eliminación de lógica de archivos de las aplicaciones

---

## Principio fundamental

> Un archivo no pertenece a una app.  
> Pertenece al sistema.

**Consecuencia:** Las apps crean referencias (`fileId`), solicitan accesos (`shareToken`), renderizan contenido. ControlFile valida permisos, decide cómo se accede, protege el storage real.

---

## Referencias

- TRUTH.md §1, §2
- 02_FILOSOFIA_Y_PRINCIPIOS.md §1.1

