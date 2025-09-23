import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, requireAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;

    const db = requireAdminDb();
    const docRef = db.collection('userSettings').doc(userId);
    const snap = await docRef.get();
    const data = snap.exists ? snap.data() : {};

    return NextResponse.json({
      billingInterval: (data as any)?.billingInterval || null,
    });
  } catch (error) {
    console.error('Error getting user settings:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;

    const { billingInterval } = await request.json();
    if (billingInterval !== 'monthly' && billingInterval !== 'yearly') {
      return NextResponse.json({ error: 'billingInterval inválido' }, { status: 400 });
    }

    const db = requireAdminDb();
    const docRef = db.collection('userSettings').doc(userId);
    await docRef.set({ billingInterval, updatedAt: new Date() }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving user settings:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
