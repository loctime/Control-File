import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';

// Evitar pre-renderizado durante el build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const { fileId, expiresIn = 7 } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'ID de archivo requerido' }, { status: 400 });
    }

    // Get file document
    const adminDb = requireAdminDb();
    const fileRef = adminDb.collection('files').doc(fileId);
    const fileDoc = await fileRef.get();

    if (!fileDoc.exists) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    const fileData = fileDoc.data()!;
    
    // Verify file belongs to user
    if (fileData.userId !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Create share document
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shareRef = adminDb.collection('shares').doc(shareId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresIn);

    await shareRef.set({
      fileId,
      userId,
      expiresAt,
      createdAt: new Date(),
      downloadCount: 0,
    });

    return NextResponse.json({ 
      success: true, 
      shareId,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Error creating share:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
