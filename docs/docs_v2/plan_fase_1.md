Plan detallado — FASE 1 (Fundacional)
🎯 Objetivo de la fase

Crear la capa platform centralizada, consumible por todas las apps, sin lógica duplicada.

2.1 Definir el dominio platform

Decisión clave (una sola vez):

platform/
  accounts/
  payments/
  plans/
  auditLogs/ (opcional, preparado)


📌 Esto no es una app, es un dominio transversal.

2.2 Modelo platform/accounts (core absoluto)

Responsabilidad:

Estado comercial del cliente

Apps habilitadas

Límites

Flags operativos

Acciones permitidas:

leer (apps)

escribir (solo owner / backend)

Resultado:

Todas las apps dependen de este documento para permitir acceso.

2.3 Modelo platform/plans

Separar plan de account desde el inicio.

Ventajas:

no hardcodear límites

poder cambiar reglas sin migrar cuentas

Responsabilidad:

definición de límites

apps incluidas

nombre comercial

2.4 Modelo platform/payments

No automatizar aún. Solo registrar hechos.

Responsabilidad:

historial

trazabilidad

base para decisiones

Regla de oro:

Payments no activan nada por sí solos en Fase 1.

2.5 Integración mínima en cada app

En cada app (ControlAudit, ControlDoc, etc.):

Al login:

leer platform/accounts/{uid}

Guardar en contexto:

status

enabledApps

Gatear:

si status !== active

si apps.{appName} !== true

📌 Sin lógica de pagos
📌 Sin lógica de planes
📌 Solo consumo de estado

2.6 Reglas Firestore (clave)

Definir reglas claras:

Apps: read only

Owner: read/write

Nada de inferencias desde datos de app

✅ Resultado final de Fase 1

Una sola verdad

Apps desacopladas

Base sólida

Sin deuda técnica nueva
