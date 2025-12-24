import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/firebase-admin"
import { logError } from "@/lib/logger-client"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * OPTIONS /api/create-user
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
 * POST /api/create-user
 * 
 * Crea un usuario en Firebase Auth desde el backend.
 * Requiere autenticación de admin.
 * 
 * IMPORTANTE: Este endpoint debe llamarse desde el mismo dominio del frontend.
 * NO debe llamarse usando NEXT_PUBLIC_BACKEND_URL.
 * Usar ruta relativa: /api/create-user
 * 
 * Body:
 * - email: string (requerido)
 * - password: string (requerido)
 * 
 * Headers:
 * - Authorization: Bearer <firebase-id-token> (requerido)
 * 
 * Respuesta exitosa:
 * { uid: string, email: string }
 * 
 * Errores:
 * - 401: Token inválido o no proporcionado
 * - 403: Usuario no tiene permisos de admin
 * - 400: Email o password faltantes
 * - 409: Email ya existe (email-already-exists)
 * - 500: Error del servidor
 */
export async function POST(request: NextRequest) {
  try {
    // Validar token de autenticación
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
      logError(error, 'verifying token (create-user)')
      return NextResponse.json(
        { error: "Token inválido o expirado", details: error.message },
        { status: 401 }
      )
    }

    // Verificar que el usuario tenga rol de admin
    // Verifica tanto en custom claims como en el formato alternativo
    const isAdmin = decodedToken.admin === true || 
                    decodedToken.role === "admin" || 
                    decodedToken.role === "maxdev"
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: "No tienes permisos para crear usuarios. Se requiere rol de admin." },
        { status: 403 }
      )
    }

    // Validar body
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: "Body inválido. Se espera JSON." },
        { status: 400 }
      )
    }

    const { email, password } = body

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

    // Crear usuario en Firebase Auth
    try {
      const adminAuth = requireAdminAuth()
      const user = await adminAuth.createUser({
        email,
        password,
        emailVerified: false,
      })

      return NextResponse.json(
        { uid: user.uid, email: user.email },
        { status: 201 }
      )
    } catch (error: any) {
      // Manejar error de email ya existente
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
  } catch (error: any) {
    // Error general no capturado
    logError(error, 'create-user endpoint')
    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 }
    )
  }
}

