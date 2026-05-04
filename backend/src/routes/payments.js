// Payments Routes - /api/payments
const express = require('express');
const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const TIERS = {
  STANDARD: {
    priceId: process.env.STRIPE_PRICE_STANDARD,
    amount: 2900, // $29.00 in cents
    name: 'Standard Job Posting',
  },
  PREMIUM: {
    priceId: process.env.STRIPE_PRICE_PREMIUM,
    amount: 7900, // $79.00 in cents
    name: 'Premium Job Posting',
  },
};

// POST /api/payments/create-checkout - Create Stripe Checkout session
router.post('/create-checkout', authenticate, authorize('EMPLOYER'), async (req, res) => {
  try {
    const { tier, jobId } = req.body;

    if (!['STANDARD', 'PREMIUM'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be STANDARD or PREMIUM' });
    }

    // If jobId provided, verify ownership
    if (jobId) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });
      if (job.employerId !== req.user.id) return res.status(403).json({ error: 'Not your job' });
    }

    const tierConfig = TIERS[tier];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: tierConfig.name,
            description: tier === 'PREMIUM'
              ? '60-day listing, featured placement, priority support'
              : '30-day listing, standard placement',
          },
          unit_amount: tierConfig.amount,
        },
        quantity: 1,
      }],
      metadata: {
        userId: req.user.id,
        tier,
        jobId: jobId || '',
      },
      success_url: `${process.env.FRONTEND_URL}/employer/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?payment=cancelled`,
    });

    // Create pending payment record
    await prisma.payment.create({
      data: {
        userId: req.user.id,
        stripeSessionId: session.id,
        amount: tierConfig.amount,
        tier,
        status: 'PENDING',
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/payments/webhook - Stripe webhook handler
// Note: This route uses raw body parsing (configured in index.js)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    // Verify webhook signature — CRITICAL security step
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { userId, tier, jobId } = session.metadata;

        // Update payment to completed
        const payment = await prisma.payment.update({
          where: { stripeSessionId: session.id },
          data: {
            status: 'COMPLETED',
            stripePaymentIntent: session.payment_intent,
          },
        });

        // Calculate listing expiry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (tier === 'PREMIUM' ? 60 : 30));

        if (jobId) {
          // Activate existing job with new tier
          await prisma.job.update({
            where: { id: jobId },
            data: {
              tier,
              status: 'ACTIVE',
              paymentId: payment.id,
              paidAt: new Date(),
              expiresAt,
            },
          });
        }

        console.log(`Payment completed: ${session.id}, tier: ${tier}, user: ${userId}`);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        await prisma.payment.update({
          where: { stripeSessionId: session.id },
          data: { status: 'FAILED' },
        }).catch(() => {}); // May not exist if user cancelled before record created
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.payment_intent) {
          await prisma.payment.updateMany({
            where: { stripePaymentIntent: charge.payment_intent },
            data: { status: 'REFUNDED' },
          });
        }
        break;
      }

      default:
        // Unhandled event types - log for visibility
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 to prevent Stripe from retrying — log internally
    res.json({ received: true, error: 'Internal processing error' });
  }
});

// GET /api/payments/history - Get payment history for current user
router.get('/history', authenticate, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        jobs: { select: { id: true, title: true, status: true } },
      },
    });
    res.json(payments);
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// GET /api/payments/verify/:sessionId - Verify payment after redirect
router.get('/verify/:sessionId', authenticate, async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { stripeSessionId: req.params.sessionId },
    });

    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    res.json({ status: payment.status, tier: payment.tier });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

module.exports = router;
