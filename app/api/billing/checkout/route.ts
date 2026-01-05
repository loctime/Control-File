import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/logger-client';
import Stripe from 'stripe';
import { requireAdminAuth } from '@/lib/firebase-admin';
import { findPlanById, getPlanPrice } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.NEXT_PUBLIC_BASE_URL) {
      return NextResponse.json({ error: 'Stripe no configurado' }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = requireAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;

    const { planId, interval } = await request.json();
    if (!planId) return NextResponse.json({ error: 'planId requerido' }, { status: 400 });
    if (interval && interval !== 'monthly' && interval !== 'yearly') {
      return NextResponse.json({ error: 'interval inválido' }, { status: 400 });
    }

    const plan = await findPlanById(planId);
    if (!plan) return NextResponse.json({ error: 'Plan inválido' }, { status: 400 });

    const billingInterval = (interval || 'monthly') as 'monthly' | 'yearly';
    const unitAmount = Math.round(getPlanPrice(plan, billingInterval) * 100);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Plan ${plan.name} (${billingInterval === 'monthly' ? 'Mensual' : 'Anual'})`,
            },
            unit_amount: unitAmount,
            recurring: {
              interval: billingInterval === 'monthly' ? 'month' : 'year',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings?checkout=cancel`,
      metadata: {
        userId,
        planId: plan.planId,
        interval: billingInterval,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logError(error, 'creando checkout session');
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
