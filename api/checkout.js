import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  pro: {
    name: 'Réputia Pro',
    amount: 1400,
    interval: 'month',
    trial_days: 14,
    description: 'Réponses illimitées · Tous les tons · Support par email'
  },
  multisites: {
    name: 'Réputia Multi-sites',
    amount: 3900,
    interval: 'month',
    trial_days: 14,
    description: 'Réponses illimitées · Établissements illimités · Support prioritaire'
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { plan } = req.body;
    const planConfig = PLANS[plan];

    if (!planConfig) {
      return res.status(400).json({ error: 'Plan invalide' });
    }

    const origin = req.headers.origin || 'https://reputia.vercel.app';

    // Créer le prix inline (pas besoin de le créer dans Stripe dashboard)
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: planConfig.name,
            description: planConfig.description,
          },
          unit_amount: planConfig.amount,
          recurring: { interval: planConfig.interval },
        },
        quantity: 1,
      }],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html`,
      locale: 'fr',
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      metadata: { plan },
    };

    // Ajouter la période d'essai si applicable
    if (planConfig.trial_days > 0) {
      sessionParams.subscription_data = {
        trial_period_days: planConfig.trial_days,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('Stripe error:', error);
    return res.status(500).json({ error: error.message });
  }
}
