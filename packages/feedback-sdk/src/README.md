
@controlfile/feedback-sdk

SDK oficial de ControlFile para enviar feedback visual desde aplicaciones externas.

Este SDK está diseñado para ser utilizado por:

desarrolladores humanos

agentes de IA (Cursor, ChatGPT, bots de integración)

scripts automáticos

El SDK define una única forma correcta de enviar feedback a ControlFile.

🎯 Propósito

Permitir que una app externa envíe feedback visual a ControlFile sin:

conocer endpoints internos

manejar autenticación manualmente

construir multipart requests

implementar idempotencia

duplicar lógica

👉 El SDK no implementa lógica de negocio
👉 El SDK no maneja UI
👉 El SDK no decide estados

ControlFile es el único dueño del sistema de feedback.

🧠 Modelo mental (importante)
App / Agente
   ↓
Feedback SDK
   ↓
ControlFile API
   ↓
Storage + Metadata + Auditoría


El SDK es un adaptador de contrato, no un sistema.

📦 Alcance del SDK
El SDK SÍ hace

arma el payload correcto

adjunta screenshot

obtiene el Firebase ID Token

maneja headers

maneja idempotencia (clientRequestId)

tipa inputs y outputs

normaliza errores

El SDK NO hace

capturar screenshots

mostrar UI

listar feedback global

cambiar estados

manejar permisos

almacenar datos localmente

🔧 Requisitos

Aplicación frontend (browser / WebView)

Firebase Authentication activo

Usuario autenticado

appId válido en ControlFile

📥 Instalación

Dentro del monorepo ControlFile:

packages/feedback-sdk


Este paquete no está pensado para npm público (por ahora).

🚀 Uso básico
Inicialización (obligatoria)
import { createFeedbackClient } from "@controlfile/feedback-sdk";

const feedback = createFeedbackClient({
  appId: "controlaudit",
  baseUrl: "https://api.controlfile.app",
  getToken: async () => {
    // Debe devolver un Firebase ID Token válido
    return firebaseUser?.getIdToken() ?? null;
  }
});


Reglas:

createFeedbackClient se llama una sola vez

getToken debe devolver siempre el token actual

El SDK NO guarda tokens

Enviar feedback (acción principal)
await feedback.create({
  screenshot: File,
  comment: string,
  context: {
    page: {
      url: string,
      route: string
    },
    viewport: {
      x: number,
      y: number,
      width: number,
      height: number,
      dpr: number
    },
    selection?: {
      x: number,
      y: number,
      width: number,
      height: number
    }
  },
  tenantId?: string,
  userRole?: string,
  source?: Record<string, any>
});

📤 Respuesta
{
  feedbackId: string;
  status: "open";
  createdAt: string;
}


La app o agente solo debe mostrar confirmación.
La gestión del feedback ocurre exclusivamente en ControlFile.

🔁 Idempotencia (crítico)

El SDK genera automáticamente clientRequestId

Reintentos de red NO crean duplicados

El backend devuelve el feedback existente

No implementar idempotencia adicional en la app.

🔐 Autenticación

El SDK requiere un Firebase ID Token válido

Si no hay token → lanza FeedbackAuthError

El SDK no refresca sesión

⚠️ Errores

El SDK lanza errores tipados:

FeedbackAuthError

FeedbackValidationError

FeedbackNetworkError

FeedbackServerError

Los agentes deben:

capturar errores

no reintentar a ciegas

respetar mensajes de error

🧪 Uso por agentes de IA

Este SDK es agent-compatible.

Un agente puede:

construir un File válido

generar contexto técnico

llamar feedback.create()

interpretar la respuesta

El SDK:

no requiere estado global

no depende de UI

no usa efectos secundarios ocultos

❌ Anti-patrones (NO hacer)

❌ Usar el SDK desde backend Node

❌ Enviar feedback sin screenshot

❌ Enviar feedback sin token

❌ Modificar payload manualmente

❌ Usar el SDK para listar feedback

🧩 Relación con ControlFile

Este SDK es un cliente del contrato /api/feedback.

Si el contrato cambia:

se actualiza el SDK

las apps no cambian

🧠 Regla de oro

El SDK refleja el contrato.
ControlFile gobierna el sistema.

📌 Estado del paquete

Versión: 0.1.x

Estable para uso interno

API sujeta a cambios controlados

No publicar externamente aún




Uso en una app (ejemplo real)
import { createFeedbackClient } from "@controlfile/feedback-sdk";
import { getAuth } from "firebase/auth";

const feedback = createFeedbackClient({
  appId: "controlaudit",
  baseUrl: "https://api.controlfile.app",
  getToken: async () => {
    const user = getAuth().currentUser;
    return user ? user.getIdToken() : null;
  }
});

await feedback.create({
  screenshot: file,
  comment: "Este botón no responde",
  context: {
    page: { url: window.location.href, route: "/auditorias/:id" },
    viewport: {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio
    }
  }
});