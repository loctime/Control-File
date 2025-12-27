// app/api/admin/create-user/route.ts
// este archivo es inservible sera eliminado no usar
import { NextRequest, NextResponse } from "next/server"
import { requireAdminAuth, requireAdminDb } from "@/lib/firebase-admin"
import { logError } from "@/lib/logger-client"
import { FieldValue } from 'firebase-admin/firestore'

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
 * Endpoint admin-only para creación de usuarios.
 * 
 * REQUISITOS:
 * - Token Firebase válido en header Authorization
 * - Usuario autenticado debe tener role === "supermax" en apps/auditoria/users
 * 
 * REGLA DE ORO:
 * ❌ El frontend NO debe crear usuarios Auth
 * ✅ Todo Auth se maneja solo desde backend
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
 *   "status": "created | linked",
 *   "source": "controlfile"
 * }
 * 
 * Errores:
 * - 401: Token inválido o no proporcionado
 * - 403: Usuario no tiene permisos (no es supermax)
 * - 400: Datos inválidos o faltantes
 * - 409: Email ya existe en Auth pero no hay perfil pending
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

    // 2. Verificar que el usuario tenga role === "supermax"
    const adminDb = requireAdminDb()
    const supermaxUserRef = adminDb.collection('apps').doc('auditoria').collection('users').doc(decodedToken.uid)
    const supermaxUserDoc = await supermaxUserRef.get()

    if (!supermaxUserDoc.exists) {
      return NextResponse.json(
        { error: "No tienes permisos. Se requiere perfil en apps/auditoria/users." },
        { status: 403 }
      )
    }

    const supermaxUserData = supermaxUserDoc.data()
    if (supermaxUserData?.role !== 'supermax') {
      return NextResponse.json(
        { error: "No tienes permisos. Se requiere role === 'supermax'." },
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

    // 5. Buscar perfil pending en Firestore (por email, sin uid o con status pending)
    const usersCollection = adminDb.collection('apps').doc('auditoria').collection('users')
    let pendingProfile = null
    let pendingProfileId = null

    if (userExists && authUser) {
      // Si el usuario ya existe en Auth, buscar perfil por uid primero
      const existingProfileRef = usersCollection.doc(authUser.uid)
      const existingProfileDoc = await existingProfileRef.get()
      
      if (existingProfileDoc.exists) {
        // Ya existe perfil vinculado, retornar error
        return NextResponse.json(
          { 
            error: "El email ya está registrado y tiene un perfil vinculado",
            uid: authUser.uid
          },
          { status: 409 }
        )
      }

      // Buscar todos los perfiles con este email
      const emailQuery = await usersCollection
        .where('email', '==', email)
        .get()

      // Filtrar para encontrar perfiles pending (sin uid o con status pending)
      for (const doc of emailQuery.docs) {
        const docData = doc.data()
        // Es pending si no tiene uid o tiene status pending
        if (!docData.uid || docData.status === 'pending') {
          pendingProfile = docData
          pendingProfileId = doc.id
          break
        }
      }
    } else {
      // Si el usuario no existe en Auth, buscar perfil pending por email
      const emailQuery = await usersCollection
        .where('email', '==', email)
        .get()

      // Filtrar para encontrar perfiles pending (sin uid o con status pending)
      for (const doc of emailQuery.docs) {
        const docData = doc.data()
        // Es pending si no tiene uid o tiene status pending
        if (!docData.uid || docData.status === 'pending') {
          pendingProfile = docData
          pendingProfileId = doc.id
          break
        }
      }
    }

    // 6. Crear usuario en Firebase Auth o usar el existente
    let uid: string
    let status: 'created' | 'linked'

    if (userExists && authUser) {
      // Usuario ya existe en Auth
      uid = authUser.uid
      
      if (pendingProfile && pendingProfileId) {
        // Vincular perfil pending con el uid existente
        // Crear objeto sin el campo status si existe
        const { status: _, ...profileWithoutStatus } = pendingProfile
        await usersCollection.doc(uid).set({
          ...profileWithoutStatus,
          uid: uid,
          email: email,
          nombre: nombre,
          role: role,
          appId: appId,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })

        // Eliminar el documento pending antiguo si tiene un ID diferente al uid
        if (pendingProfileId !== uid) {
          await usersCollection.doc(pendingProfileId).delete()
        }

        status = 'linked'
      } else {
        // Crear nuevo perfil para el usuario existente
        await usersCollection.doc(uid).set({
          uid: uid,
          email: email,
          nombre: nombre,
          role: role,
          appId: appId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })

        status = 'linked'
      }
    } else {
      // Crear nuevo usuario en Firebase Auth
      try {
        const newUser = await adminAuth.createUser({
          email,
          password,
          emailVerified: false,
          displayName: nombre,
        })

        uid = newUser.uid

        // Crear o actualizar perfil en Firestore
        if (pendingProfile && pendingProfileId) {
          // Vincular perfil pending con el nuevo uid
          // Crear objeto sin el campo status si existe
          const { status: _, ...profileWithoutStatus } = pendingProfile
          await usersCollection.doc(uid).set({
            ...profileWithoutStatus,
            uid: uid,
            email: email,
            nombre: nombre,
            role: role,
            appId: appId,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true })

          // Eliminar el documento pending antiguo si tiene un ID diferente al uid
          if (pendingProfileId !== uid) {
            await usersCollection.doc(pendingProfileId).delete()
          }

          status = 'linked'
        } else {
          // Crear nuevo perfil
          await usersCollection.doc(uid).set({
            uid: uid,
            email: email,
            nombre: nombre,
            role: role,
            appId: appId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })

          status = 'created'
        }
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
    }

    // 7. Responder con éxito
    return NextResponse.json(
      {
        uid: uid,
        status: status,
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

