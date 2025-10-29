import { NextRequest, NextResponse } from 'next/server';
import { logger, logError } from '@/lib/logger-client';
import Stripe from 'stripe';
import { requireAdminDb } from '@/lib/firebase-admin';
import { findPlanById } from '@/lib/plans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    logger.warn('Webhook signature verification failed', { message: err.message });
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId as string | undefined;
      const planId = session.metadata?.planId as string | undefined;
      const interval = (session.metadata?.interval as 'monthly' | 'yearly' | undefined) || 'monthly';

      if (userId && planId) {
        const plan = findPlanById(planId);
        if (plan) {
          const db = requireAdminDb();
          const userRef = db.collection('users').doc(userId);
          await userRef.set({
            planId: plan.planId,
            planQuotaBytes: plan.quotaBytes,
            planInterval: interval,
            planUpdatedAt: new Date(),
          }, { merge: true });
        }
      }
    }
  } catch (error) {
    logError(error, 'processing webhook');
    return NextResponse.json({ received: true }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
