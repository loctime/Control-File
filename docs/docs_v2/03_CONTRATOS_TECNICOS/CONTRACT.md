📜 ControlFile – App Integration Contract (v1)
1. Principio de autoridad

ControlFile es la única autoridad sobre:

estructura visible (navbar / taskbar)

reglas de UX

jerarquía permitida

Las aplicaciones externas son clientes, no co-dueñas del filesystem.

2. Conceptos fundamentales
2.1 Jerarquía de carpetas

Se define exclusivamente por parentId

parentId = null → carpeta raíz

parentId = <id> → subcarpeta

⚠️ Jerarquía ≠ UX

2.2 Navbar

Representa carpetas creadas manualmente por el usuario

Es exploratorio

Es exclusivo de ControlFile UI

👉 Las apps NO pueden crear carpetas en el navbar

2.3 Taskbar

Representa accesos rápidos de aplicaciones

No depende de parentId

No depende de metadata.source

Se define únicamente por:

userSettings.taskbarItems

3. Reglas duras (obligatorias)
3.1 Creación de carpetas
❌ Prohibido para apps

Crear carpetas con parentId = null

Crear carpetas visibles en navbar

Auto-pinnear carpetas

✅ Permitido para apps

Solicitar su carpeta raíz de aplicación mediante API dedicada

Crear subcarpetas dentro de su root

3.2 ControlFile UI

Puede crear carpetas raíz (parentId = null)

Esas carpetas aparecen en navbar

No se auto-agregan al taskbar

4. APIs contractuales (oficiales)
4.1 App Root (obligatorio para apps)
POST /api/apps/:appId/root


Responsabilidad de ControlFile:

crear (o reutilizar) carpeta raíz de la app

NO exponerla en navbar

SÍ agregarla al taskbar

operación idempotente

Las apps no eligen parentId ni UX.

4.2 Taskbar API (explícita)
GET  /api/taskbar
POST /api/taskbar/pin
POST /api/taskbar/unpin


Operan solo sobre userSettings.taskbarItems

No crean carpetas

No modifican jerarquía

5. SDK – ensurePath (contrato mínimo)

Las apps no crean carpetas directamente.

Usan:

ensurePath({
  appId: 'controldoc',
  path: 'documentos/aprobados'
})


ControlFile garantiza:

existencia

ubicación correcta

coherencia UX

6. metadata.source (estado v1)

No tiene valor contractual

No define UX

No define jerarquía

👉 No debe ser usado por apps

(Se elimina o se redefine en v2)

7. Compatibilidad hacia atrás

Hasta que este contrato se implemente:

el backend sigue siendo permisivo

pero la documentación deja claro que:

crear carpetas raíz desde apps es comportamiento no soportado

cualquier app que lo haga está fuera de contrato

8. Beneficios del contrato

Navbar limpio

Taskbar predecible

SDK simple

UX consistente

Plataforma gobernada (no anárquica)