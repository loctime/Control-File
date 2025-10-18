// lib/middleware/api-auth.ts - Middleware de autenticación reutilizable
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/firebase-admin';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { ZodError, ZodIssue } from 'zod';

export interface AuthenticatedRequest extends NextRequest {
  userId?: string;
  userEmail?: string;
}

export type ApiHandler<T = any> = (
  request: NextRequest,
  context: { userId: string; userEmail?: string }
) => Promise<NextResponse<T>>;

/**
 * Middleware para proteger endpoints que requieren autenticación
 * Valida el token de Firebase y proporciona el userId al handler
 */
export function withAuth<T = any>(handler: ApiHandler<T>) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    const path = new URL(request.url).pathname;
    const method = request.method;

    try {
      // Verificar header de autorización
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        logApiError(method, path, new Error('Missing authorization header'));
        return NextResponse.json(
          { error: 'No autorizado', code: 'AUTH_MISSING' } as any,
          { status: 401 }
        );
      }

      // Extraer token
      const token = authHeader.split('Bearer ')[1];
      if (!token) {
        return NextResponse.json(
          { error: 'Token inválido', code: 'AUTH_INVALID_TOKEN' } as any,
          { status: 401 }
        );
      }

      // Verificar token con Firebase Admin
      const adminAuth = requireAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(token);

      if (!decodedToken.uid) {
        return NextResponse.json(
          { error: 'Token sin UID', code: 'AUTH_NO_UID' } as any,
          { status: 401 }
        );
      }

      // Log de request autenticado
      logApiRequest(method, path, decodedToken.uid);

      // Llamar al handler con el contexto de autenticación
      return await handler(request, {
        userId: decodedToken.uid,
        userEmail: decodedToken.email,
      });
    } catch (error: any) {
      // Manejar errores de autenticación específicos
      if (error.code === 'auth/id-token-expired') {
        return NextResponse.json(
          { error: 'Token expirado', code: 'AUTH_TOKEN_EXPIRED' } as any,
          { status: 401 }
        );
      }

      if (error.code === 'auth/id-token-revoked') {
        return NextResponse.json(
          { error: 'Token revocado', code: 'AUTH_TOKEN_REVOKED' } as any,
          { status: 401 }
        );
      }

      if (error.code === 'auth/argument-error') {
        return NextResponse.json(
          { error: 'Token malformado', code: 'AUTH_TOKEN_MALFORMED' } as any,
          { status: 401 }
        );
      }

      // Error genérico
      logApiError(method, path, error);
      logger.error('Authentication error', {
        method,
        path,
        errorCode: error.code,
        errorMessage: error.message,
      });

      return NextResponse.json(
        { error: 'Error de autenticación', code: 'AUTH_ERROR' } as any,
        { status: 401 }
      );
    }
  };
}

/**
 * Helper para validar schemas de Zod con manejo de errores consistente
 */
export async function validateRequest<T>(
  request: NextRequest,
  schema: any
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map((err: ZodIssue) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Datos inválidos',
            code: 'VALIDATION_ERROR',
            details: errors,
          },
          { status: 400 }
        ),
      };
    }

    return { success: true, data: parsed.data };
  } catch (error) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Error al parsear el body',
          code: 'PARSE_ERROR',
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Helper para crear respuestas de error consistentes
 */
export function createErrorResponse(
  error: Error | string,
  status: number = 500,
  code?: string
): NextResponse {
  const message = typeof error === 'string' ? error : error.message;
  const isDev = process.env.NODE_ENV === 'development';

  return NextResponse.json(
    {
      error: message,
      code: code || 'INTERNAL_ERROR',
      ...(isDev && typeof error === 'object' && { stack: error.stack }),
    },
    { status }
  );
}

/**
 * Helper para crear respuestas exitosas consistentes
 */
export function createSuccessResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    { status }
  );
}

