// Vercel Serverless Function: /api/stripe-webhook
// Handles Stripe webhook events for subscription lifecycle

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://dciiqcoinlaradmjnkxv.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

// Disable body parsing for raw webhook body
module.exports.config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const agencyName = session.metadata?.agency_name;
      const tier = session.metadata?.tier;
      const subId = session.subscription;
      const customerId = session.customer;

      if (agencyName && tier) {
        // Find or create agency
        const { data: existing } = await supabase
          .from('raf_agencies')
          .select('id')
          .ilike('name', `%${agencyName}%`)
          .limit(1);

        if (existing && existing.length > 0) {
          const agencyId = existing[0].id;
          // Update agency tier
          await supabase.from('raf_agencies').update({
            tier: tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subId,
            updated_at: new Date().toISOString()
          }).eq('id', agencyId);

          // Create subscription record
          await supabase.from('raf_subscriptions').insert({
            agency_id: agencyId,
            tier: tier,
            stripe_subscription_id: subId,
            status: 'active',
            current_period_start: new Date().toISOString()
          });
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      await supabase.from('raf_subscriptions')
        .update({
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString()
        })
        .eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      // Downgrade to free
      await supabase.from('raf_subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', sub.id);

      // Find and downgrade agency
      const { data: agency } = await supabase
        .from('raf_agencies')
        .select('id')
        .eq('stripe_subscription_id', sub.id)
        .limit(1);

      if (agency && agency.length > 0) {
        await supabase.from('raf_agencies').update({
          tier: 'free',
          updated_at: new Date().toISOString()
        }).eq('id', agency[0].id);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('Payment failed for subscription:', invoice.subscription);
      // Could send notification email here
      break;
    }
  }

  res.status(200).json({ received: true });
};
