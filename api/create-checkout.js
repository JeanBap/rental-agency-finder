// Vercel Serverless Function: /api/create-checkout
// Creates a Stripe Checkout session for agency subscription

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  starter_annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  advanced_monthly: process.env.STRIPE_PRICE_ADVANCED_MONTHLY,
  advanced_annual: process.env.STRIPE_PRICE_ADVANCED_ANNUAL,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { tier, billing, email, agencyName } = req.body;

    const priceKey = `${tier}_${billing || 'monthly'}`;
    const priceId = PRICE_IDS[priceKey];
    if (!priceId) return res.status(400).json({ error: 'Invalid tier or billing period' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        agency_name: agencyName,
        tier: tier,
      },
      success_url: `${process.env.SITE_URL || 'https://www.rentalagencyfinder.com'}/for-agencies?success=true&tier=${tier}`,
      cancel_url: `${process.env.SITE_URL || 'https://www.rentalagencyfinder.com'}/for-agencies?cancelled=true`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: err.message });
  }
};
