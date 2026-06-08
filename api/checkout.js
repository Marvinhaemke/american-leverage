// Vercel Serverless Function: Self-Serve checkout
// -------------------------------------------------------------------------
// The browser (self-serve.html) sends ONLY the customer's `selection`, which
// of LLC / EIN / ITIN they already have. The final amount is computed HERE,
// server-side, so the price can never be manipulated in the browser.
//
// SOURCE OF TRUTH for prices. Keep these numbers in sync with the PRICING
// object in self-serve.html (which is display-only).  <-- SET REAL VALUES
//
// TODO (Marvin):
//   1. Create a real payment session (e.g. Stripe Checkout) for `amount` and
//      return { url } so the frontend can redirect to it.
//   2. Persist `selection` together with the order (DB / CRM): per-customer
//      signal of what they already have. Gold for upsell + ICP data.
//   3. (Optional) set prices via env vars instead of hard-coding.

const CURRENCY = 'USD';
const BASE_PRICE = 1500;                          // base package price
const COMPONENTS = { llc: 300, ein: 200, itin: 500 }; // deducted when already owned

function computeAmount(selection) {
  let amount = BASE_PRICE;
  const normalized = {};
  for (const key of Object.keys(COMPONENTS)) {
    const owned = selection && selection[key] === true;
    normalized[key] = owned;
    if (owned) amount -= COMPONENTS[key];
  }
  if (amount < 0) amount = 0;
  return { amount, selection: normalized };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const selection = (body && body.selection) || {};

  const { amount, selection: normalized } = computeAmount(selection);

  // -----------------------------------------------------------------------
  // TODO: create the payment session + persist the order here.
  //
  //   const session = await stripe.checkout.sessions.create({
  //     mode: 'payment',
  //     line_items: [{
  //       price_data: {
  //         currency: CURRENCY,
  //         product_data: { name: 'American Leverage Self-Serve US Setup' },
  //         unit_amount: amount * 100,            // amount is server-computed
  //       },
  //       quantity: 1,
  //     }],
  //     metadata: {                                // persisted with the order
  //       already_has_llc: String(normalized.llc),
  //       already_has_ein: String(normalized.ein),
  //       already_has_itin: String(normalized.itin),
  //     },
  //     success_url: 'https://<domain>/confirmation',
  //     cancel_url:  'https://<domain>/self-serve',
  //   });
  //   await saveOrder({ selection: normalized, amount });   // your DB / CRM
  //   return res.status(200).json({ url: session.url, amount, currency: CURRENCY, selection: normalized });
  // -----------------------------------------------------------------------

  // Until the payment provider is wired, return the authoritative price so the
  // frontend (and you) can verify the calculation. `url` is null for now.
  return res.status(200).json({
    url: null,
    amount,
    currency: CURRENCY,
    selection: normalized,
  });
};
