ControlFile – Guía de Integración
Sistema Global de Feedback (Apps Externas)

Esta guía explica cómo una app externa (ej: ControlAudit) puede permitir que sus usuarios envíen feedback visual a ControlFile.

👉 La app NO implementa lógica de feedback.
👉 La app SOLO captura y envía.
👉 ControlFile gestiona todo lo demás.

1️⃣ Requisitos previos (obligatorios)

Antes de integrar feedback, la app debe cumplir:

Usar Firebase Authentication

Poder obtener el Firebase ID Token del usuario autenticado

Tener un appId registrado y permitido en ControlFile

Conocer si su app es multi-tenant o no

2️⃣ Qué debe hacer la app (y qué NO)
✅ La app DEBE:

Mostrar un botón o acción “Enviar feedback”

Capturar un screenshot (pantalla completa o área)

Pedir un comentario al usuario

Enviar el payload a ControlFile

❌ La app NO DEBE:

Guardar feedback localmente

Persistir screenshots

Decidir estados (open / resolved / etc.)

Implementar auditoría

Listar feedback global

3️⃣ Flujo básico de integración (MVP)
Paso 1 — Captura de screenshot

La app debe capturar una imagen del estado actual de la UI.

Formato permitido:

PNG

JPEG

Tamaño máximo:

10MB

Paso 2 — Construir el payload

El payload SIEMPRE se envía como JSON string dentro de un multipart/form-data.

Payload mínimo requerido
{
  "appId": "controlaudit",
  "tenantId": "empresa_123", // null si no aplica
  "comment": "Acá el botón no responde",
  "context": {
    "page": {
      "url": "https://controlaudit.app/auditorias/123",
      "route": "/auditorias/:id"
    },
    "viewport": {
      "x": 0,
      "y": 0,
      "width": 1440,
      "height": 900,
      "dpr": 1
    }
  }
}

Campos opcionales recomendados
{
  "userRole": "auditor",
  "clientRequestId": "uuid-generado-por-la-app",
  "source": {
    "appVersion": "1.4.2",
    "build": "2026.01.08"
  }
}

4️⃣ Envío a ControlFile
Endpoint
POST /api/feedback

Headers
Authorization: Bearer <Firebase ID Token>
Content-Type: multipart/form-data

Body (multipart)
Campo	Tipo	Descripción
payload	string	JSON string con metadata
screenshot	file	Imagen PNG/JPEG
5️⃣ Respuesta esperada
{
  "success": true,
  "feedbackId": "feedback_1736357000_x8f2",
  "screenshotFileId": "file_1736356999_a92k",
  "status": "open",
  "createdAt": "2026-01-08T18:32:00Z"
}


👉 La app solo debe mostrar “Feedback enviado”.
👉 El estado real vive en ControlFile.

6️⃣ Idempotencia (MUY IMPORTANTE)

Para evitar feedback duplicado:

La app debe generar un clientRequestId único

Si la red falla y se reintenta, ControlFile devolverá el feedback existente

👉 Recomendado: UUID v4.

7️⃣ Multi-tenant (si aplica)

Si la app es multi-tenant:

tenantId ES OBLIGATORIO

Si no lo es:

tenantId debe enviarse como null

👉 ControlFile usa tenantId para aislamiento de datos.

8️⃣ Qué puede mostrar la app después

Opcionalmente, la app puede:

Mostrar un toast: “Feedback enviado”

Guardar localmente el feedbackId (solo informativo)

Consultar estado solo si ControlFile expone ese endpoint

❌ La app NO debe:

Cambiar estados

Listar feedback de otros usuarios

9️⃣ Resumen ultra corto (para devs)
App:
- captura screenshot
- arma payload
- manda POST /api/feedback
- muestra “enviado”

ControlFile:
- guarda archivo
- guarda metadata
- maneja estados
- audita

10️⃣ Frase oficial para documentación interna

“El sistema de feedback es un servicio centralizado de ControlFile.
Las apps externas solo actúan como capturadores de contexto y emisores de feedback.”