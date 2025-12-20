import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/api-auth';
import { requireAdminDb } from '@/lib/firebase-admin';
import { uploadFileDirectly, createPresignedGetUrl } from '@/lib/b2';
import { logger, logError } from '@/lib/logger-client';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(
  request: NextRequest,
  { userId }: { userId: string }
): Promise<NextResponse> {
  try {
    // Parsear multipart/form-data
    const formData = await request.formData();
    
    // Validar campo obligatorio: file
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { error: 'Campo "file" es obligatorio', code: 'MISSING_FILE' },
        { status: 400 }
      );
    }

    // Obtener campos adicionales
    const sourceApp = formData.get('sourceApp') as string | null;
    const auditId = formData.get('auditId') as string | null;
    const companyId = formData.get('companyId') as string | null;
    const metadataStr = formData.get('metadata') as string | null;

    // Validar campos requeridos para ControlAudit
    if (!auditId || !companyId) {
      return NextResponse.json(
        { error: 'Los campos "auditId" y "companyId" son obligatorios', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    // Parsear metadata si existe
    let metadata: Record<string, any> = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch (error) {
        return NextResponse.json(
          { error: 'El campo "metadata" debe ser un JSON válido', code: 'INVALID_METADATA' },
          { status: 400 }
        );
      }
    }

    // Obtener información del archivo
    const fileName = file.name;
    const fileSize = file.size;
    const fileType = file.type || 'application/octet-stream';
    
    // Obtener extensión del archivo
    const fileExtension = fileName.includes('.') 
      ? fileName.split('.').pop()?.toLowerCase() || ''
      : '';

    // Generar UUID para el archivo
    const fileUuid = randomUUID();
    
    // Generar ruta en Backblaze: audits/{companyId}/{auditId}/{uuid}.{ext}
    const bucketPath = `audits/${companyId}/${auditId}/${fileUuid}${fileExtension ? '.' + fileExtension : ''}`;

    // Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Subir archivo a Backblaze
    logger.info('Subiendo archivo a Backblaze', {
      bucketPath,
      fileName,
      fileSize,
      userId,
      sourceApp: sourceApp || 'controlaudit',
    });

    const uploadResult = await uploadFileDirectly(bucketPath, buffer, fileType);

    // Generar URL de descarga (presignada por 1 hora)
    const fileURL = await createPresignedGetUrl(bucketPath, 3600);

    // Guardar metadata en Firestore
    const adminDb = requireAdminDb();
    const fileRef = adminDb.collection('files').doc();
    const fileId = fileRef.id;

    const fileData = {
      id: fileId,
      sourceApp: sourceApp || 'controlaudit',
      companyId,
      auditId,
      fileName,
      fileURL,
      bucketPath,
      metadata,
      uploadedBy: userId,
      createdAt: new Date(),
      // Campos adicionales para compatibilidad
      userId,
      name: fileName,
      size: fileSize,
      mime: fileType,
      type: 'file',
      updatedAt: new Date(),
      deletedAt: null,
    };

    await fileRef.set(fileData);

    logger.info('Archivo subido exitosamente', {
      fileId,
      bucketPath,
      fileName,
      userId,
    });

    // Responder con fileId y fileURL
    return NextResponse.json({
      fileId,
      fileURL,
    });

  } catch (error: any) {
    logError(error, 'upload file from external app');
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

