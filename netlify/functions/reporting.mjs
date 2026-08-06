// Netlify Function (Functions 2.0): Reporting → Zapier bridge
// Receives purchase / expense reports from the browser forms at
// /reporting/purchase and /reporting/expense and forwards them to a Zapier
// "Catch Hook" webhook. Proxying through the server keeps the webhook URL out
// of the page source and avoids browser CORS issues.
//
// Env vars (set in Netlify → Site configuration → Environment variables):
//   ZAPIER_REPORTING_WEBHOOK_URL  - shared Catch Hook URL (REQUIRED unless the
//                                   per-type vars below are both set)
//   ZAPIER_PURCHASE_WEBHOOK_URL   - (optional) overrides the shared URL for
//                                   report_type "purchase"
//   ZAPIER_EXPENSE_WEBHOOK_URL    - (optional) overrides the shared URL for
//                                   report_type "expense"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

function webhookFor(type) {
  if (type === 'purchase' && process.env.ZAPIER_PURCHASE_WEBHOOK_URL) {
    return process.env.ZAPIER_PURCHASE_WEBHOOK_URL;
  }
  if (type === 'expense' && process.env.ZAPIER_EXPENSE_WEBHOOK_URL) {
    return process.env.ZAPIER_EXPENSE_WEBHOOK_URL;
  }
  return process.env.ZAPIER_REPORTING_WEBHOOK_URL;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  body = body || {};

  // Honeypot: real users leave this empty; bots fill it in.
  if (body.company_url) return json({ ok: true });

  const type = body.type === 'expense' ? 'expense' : (body.type === 'purchase' ? 'purchase' : '');
  const email = String(body.email || '').trim();
  const item = String(body.item || '').trim();
  const amountRaw = String(body.amount == null ? '' : body.amount).trim();

  if (!type) return json({ error: 'type must be "purchase" or "expense"' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'A valid client email is required' }, 400);
  if (!item) return json({ error: 'A description of what was purchased is required' }, 400);

  // Parse the amount to a number, tolerating currency symbols / thousands separators.
  const amount = parseFloat(amountRaw.replace(/[^0-9.\-]/g, ''));
  if (!amountRaw || isNaN(amount)) return json({ error: 'A valid amount is required' }, 400);

  const url = webhookFor(type);
  if (!url) return json({ error: 'Server misconfigured: Zapier webhook URL missing' }, 500);

  const payload = {
    report_type: type,
    client_email: email,
    item: item,
    amount: amount,
    amount_raw: amountRaw,
    submitted_at: new Date().toISOString(),
    source_url: req.headers.get('referer') || undefined,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      return json({ error: 'Zapier webhook error', details }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Failed to reach Zapier', message: err.message }, 502);
  }
}

export const config = { path: '/api/reporting' };
