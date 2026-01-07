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
 * PARCHE TRANSITORIO: Endpoint simplificado para creación de usuarios.
 * 
 * AUTORIZACIÓN:
 * - Token Firebase válido en header Authorization
 * - Custom claims del token:
 *   - decodedToken.appId === 'auditoria'
 *   - decodedToken.role in ['admin', 'supermax']
 * 
 * FUNCIONALIDAD:
 * - Crea usuario en Firebase Auth
 * - Setea custom claims al nuevo usuario
 * - NO escribe Firestore de ninguna app (Firestore owner-centric exclusivo de ControlAudit)
 * 
 * Body esperado:
 * {
 *   "email": "cliente@empresa.com",
 *   "password": "Temporal123!",
 *   "nombre": "Empresa X",
 *   "role": "max",
 *   "appId": "auditoria"
 * }
 * 
 * Respuesta exitosa:
 * {
 *   "uid": "firebaseAuthUid",
 *   "status": "created",
 *   "source": "controlfile"
 * }
 * 
 * Errores:
 * - 401: Token inválido o no proporcionado
 * - 403: Usuario no tiene permisos (custom claims inválidos)
 * - 400: Datos inválidos o faltantes
 * - 409: Email ya existe en Auth
 * - 500: Error del servidor
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

    // 5. Si el usuario ya existe, retornar error
    if (userExists && authUser) {
      return NextResponse.json(
        { 
          error: "El email ya está registrado en Firebase Auth",
          uid: authUser.uid
        },
        { status: 409 }
      )
    }

    // 6. Crear nuevo usuario en Firebase Auth
    let uid: string
    try {
      const newUser = await adminAuth.createUser({
        email,
        password,
        emailVerified: false,
        displayName: nombre,
      })

      uid = newUser.uid

      // 7. Setear custom claims al nuevo usuario
      await adminAuth.setCustomUserClaims(uid, {
        appId: appId,
        role: role,
      })

    } catch (error: any) {
      // Manejar error de email ya existente (race condition)
      if (error.code === "auth/email-already-exists" || 
          error.message?.includes("email-already-exists") ||
          error.message?.includes("already exists")) {
        return NextResponse.json(
          { error: "email-already-exists", message: "El email ya está registrado" },
          { status: 409 }
        )
      }

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

    // 8. Responder con éxito
    // NOTA: NO escribimos Firestore - Firestore owner-centric queda exclusivo de ControlAudit
    return NextResponse.json(
      {
        uid: uid,
        status: "created",
        source: "controlfile"
      },
      { status: 201 }
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

