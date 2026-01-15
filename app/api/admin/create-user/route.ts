// app/api/admin/create-user/route.ts
// PARCHE TRANSITORIO: Compatibilidad con modelo owner-centric
// Firestore owner-centric queda EXCLUSIVO de ControlAudit
import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/firebase-admin"
import { logError } from "@/lib/logger-client"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * OPTIONS /api/admin/create-user
 * Maneja las peticiones CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

/**
 * POST /api/admin/create-user
 * 
 * ⚠️ ENDPOINT DE IDENTIDAD (IAM/Core) - NO LLAMAR DESDE FRONTEND
 * 
 * Este endpoint es parte de la infraestructura IAM/Core de ControlFile.
 * Su responsabilidad es SOLO identidad (Auth + Claims), NO lógica de negocio.
 * 
 * ⚠️ IMPORTANTE: Este endpoint NO debe ser llamado directamente por frontends.
 * Debe ser llamado únicamente por backends de apps (ControlAudit, ControlDoc, etc.)
 * que orquestan flujos completos de creación de usuarios.
 * 
 * RESPONSABILIDAD:
 * - ✅ Crear usuario en Firebase Auth (si no existe)
 * - ✅ Reutilizar UID existente (si el email ya existe en Auth)
 * - ✅ Aplicar/actualizar custom claims (appId, role, ownerId)
 * - ✅ Retornar uid del usuario (creado o reutilizado)
 * 
 * LO QUE NO HACE:
 * - ❌ NO escribe Firestore de ninguna app
 * - ❌ NO valida límites de negocio
 * - ❌ NO aplica reglas de aplicación
 * - ❌ NO crea documentos de usuario en Firestore
 * 
 * AUTORIZACIÓN:
 * - Token Firebase válido en header Authorization: Bearer <token>
 * - Custom claims del token:
 *   - decodedToken.appId === 'auditoria' (o la app correspondiente)
 *   - decodedToken.role in ['admin', 'supermax']
 * 
 * CONTRATO FIJO:
 * 
 * Inputs requeridos:
 * {
 *   "email": string,        // Email del usuario
 *   "password": string,     // Contraseña temporal
 *   "nombre": string,       // Nombre a mostrar (se mapea internamente a displayName de Firebase Auth)
 *   "role": string,         // Rol del usuario en la app
 *   "appId": string         // Identificador de la app (ej: "auditoria")
 * }
 * 
 * Nota sobre naming: El parámetro es "nombre" (decisión de dominio), pero internamente
 * se mapea a "displayName" de Firebase Auth. Si se abre el endpoint a más apps en el futuro,
 * considerar estandarizar a "displayName" para alinearse con Firebase Auth.
 * 
 * Output:
 * {
 *   "uid": string,          // UID del usuario (creado o reutilizado)
 *   "status": "created" | "reused",  // Estado de la operación
 *   "source": "controlfile" // Origen de la creación
 * }
 * 
 * QUIÉN DEBE LLAMARLO:
 * - ✅ Backends de apps (ControlAudit, ControlDoc, etc.)
 * - ❌ Frontends directamente
 * 
 * FLUJO RECOMENDADO:
 * 1. Frontend llama a su app backend (ej: POST /api/operarios/create)
 * 2. App backend llama a este endpoint para crear identidad
 * 3. App backend escribe Firestore con lógica de negocio
 * 4. App backend aplica validaciones de negocio
 * 
 * COMPORTAMIENTO MULTI-APP (Opción A - Auth global reutilizable):
 * - Si el email NO existe en Auth → crear usuario nuevo
 * - Si el email YA existe en Auth → reutilizar UID existente
 * - En ambos casos: setear/actualizar custom claims { appId, role, ownerId }
 * - NO cambiar password si el usuario ya existe
 * - NO escribir Firestore (responsabilidad de cada app)
 * 
 * Errores:
 * - 401: Token inválido o no proporcionado
 * - 403: Usuario no tiene permisos (custom claims inválidos)
 * - 400: Datos inválidos o faltantes
 * - 500: Error del servidor
 * 
 * Referencia: docs/docs_v2/IAM_CORE_CONTRACT.md
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar token de autenticación
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Token de autenticación requerido" },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remover "Bearer "

    let decodedToken
    try {
      const adminAuth = requireAdminAuth()
      decodedToken = await adminAuth.verifyIdToken(token)
    } catch (error: any) {
      logError(error, 'verifying token (admin/create-user)')
      return NextResponse.json(
        { error: "Token inválido o expirado", details: error.message },
        { status: 401 }
      )
    }

    // 2. Autorizar SOLO por custom claims del token
    if (decodedToken.appId !== 'auditoria') {
      return NextResponse.json(
        { error: "No tienes permisos. Se requiere appId === 'auditoria' en custom claims." },
        { status: 403 }
      )
    }

    const allowedRoles = ['admin', 'supermax']
    if (!decodedToken.role || !allowedRoles.includes(decodedToken.role)) {
      return NextResponse.json(
        { error: `No tienes permisos. Se requiere role in ['admin', 'supermax'] en custom claims.` },
        { status: 403 }
      )
    }

    // 3. Validar body
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: "Body inválido. Se espera JSON." },
        { status: 400 }
      )
    }

    const { email, password, nombre, role, appId } = body

    // Validar campos requeridos
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email es requerido y debe ser un string" },
        { status: 400 }
      )
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password es requerido y debe ser un string" },
        { status: 400 }
      )
    }

    if (!nombre || typeof nombre !== "string") {
      return NextResponse.json(
        { error: "Nombre es requerido y debe ser un string" },
        { status: 400 }
      )
    }

    if (!role || typeof role !== "string") {
      return NextResponse.json(
        { error: "Role es requerido y debe ser un string" },
        { status: 400 }
      )
    }

    if (!appId || typeof appId !== "string" || appId !== "auditoria") {
      return NextResponse.json(
        { error: "appId es requerido y debe ser 'auditoria'" },
        { status: 400 }
      )
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Formato de email inválido" },
        { status: 400 }
      )
    }

    // Validar longitud mínima de password
    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      )
    }

    const adminAuth = requireAdminAuth()

    // 4. Verificar si el email ya existe en Firebase Auth
    let authUser
    let userExists = false
    
    try {
      authUser = await adminAuth.getUserByEmail(email)
      userExists = true
    } catch (error: any) {
      // Si el error es que el usuario no existe, continuamos con la creación
      if (error.code !== 'auth/user-not-found') {
        logError(error, 'checking if user exists (admin/create-user)')
        return NextResponse.json(
          { error: "Error verificando usuario", details: error.message },
          { status: 500 }
        )
      }
    }

    let uid: string
    let status: "created" | "reused"

    // 5. OPCIÓN A: Auth global reutilizable
    if (userExists && authUser) {
      // Usuario ya existe → reutilizar UID y actualizar claims
      uid = authUser.uid
      status = "reused"

      // Actualizar custom claims (NO cambiar password)
      // ownerId se toma del token del admin que crea el usuario (decodedToken.uid)
      try {
        await adminAuth.setCustomUserClaims(uid, {
          appId: appId,
          role: role,
          ownerId: decodedToken.uid,
        })

        // Opcional: actualizar displayName si es diferente
        if (authUser.displayName !== nombre) {
          await adminAuth.updateUser(uid, {
            displayName: nombre,
          })
        }
      } catch (error: any) {
        logError(error, 'updating claims for existing user (admin/create-user)')
        return NextResponse.json(
          { error: "Error actualizando claims del usuario", details: error.message },
          { status: 500 }
        )
      }
    } else {
      // 6. Usuario NO existe → crear nuevo usuario en Firebase Auth
      try {
        const newUser = await adminAuth.createUser({
          email,
          password,
          emailVerified: false,
          displayName: nombre,
        })

        uid = newUser.uid
        status = "created"

        // 7. Setear custom claims al nuevo usuario
        // ownerId se toma del token del admin que crea el usuario (decodedToken.uid)
        await adminAuth.setCustomUserClaims(uid, {
          appId: appId,
          role: role,
          ownerId: decodedToken.uid,
        })

      } catch (error: any) {
        // Manejar error de email ya existente (race condition)
        if (error.code === "auth/email-already-exists" || 
            error.message?.includes("email-already-exists") ||
            error.message?.includes("already exists")) {
          // En caso de race condition, intentar reutilizar el usuario
          try {
            authUser = await adminAuth.getUserByEmail(email)
            uid = authUser.uid
            status = "reused"
            
            await adminAuth.setCustomUserClaims(uid, {
              appId: appId,
              role: role,
              ownerId: decodedToken.uid,
            })
          } catch (retryError: any) {
            logError(retryError, 'retrying after race condition (admin/create-user)')
            return NextResponse.json(
              { error: "Error al procesar usuario", details: retryError.message },
              { status: 500 }
            )
          }
        } else {
          // Otros errores de Firebase Auth
          if (error.code?.startsWith("auth/")) {
            logError(error, 'creating user (firebase auth error)')
            return NextResponse.json(
              { error: error.code, message: error.message || "Error al crear usuario" },
              { status: 400 }
            )
          }

          // Error desconocido
          logError(error, 'creating user (unknown error)')
          return NextResponse.json(
            { error: "Error interno del servidor al crear usuario", details: error.message },
            { status: 500 }
          )
        }
      }
    }

    // 8. Responder con éxito
    // NOTA: NO escribimos Firestore - Firestore owner-centric queda exclusivo de ControlAudit
    return NextResponse.json(
      {
        uid: uid,
        status: status,
        source: "controlfile"
      },
      { status: status === "created" ? 201 : 200 }
    )

  } catch (error: any) {
    // Error general no capturado
    logError(error, 'admin/create-user endpoint')
    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 }
    )
  }
}

