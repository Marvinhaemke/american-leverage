// Vercel Serverless Function: Reporting → Zapier bridge
// Receives purchase / expense reports from the browser forms at
// /reporting/purchase and /reporting/expense and forwards them to a Zapier
// "Catch Hook" webhook. Proxying through the server keeps the webhook URL out
// of the page source and avoids browser CORS issues.
//
// Env vars (set in Vercel → Project → Settings → Environment Variables):
//   ZAPIER_REPORTING_WEBHOOK_URL  - shared Catch Hook URL (REQUIRED unless the
//                                   per-type vars below are both set)
//   ZAPIER_PURCHASE_WEBHOOK_URL   - (optional) overrides the shared URL for
//                                   report_type "purchase"
//   ZAPIER_EXPENSE_WEBHOOK_URL    - (optional) overrides the shared URL for
//                                   report_type "expense"

const SHARED_URL = process.env.ZAPIER_REPORTING_WEBHOOK_URL;
const PURCHASE_URL = process.env.ZAPIER_PURCHASE_WEBHOOK_URL;
const EXPENSE_URL = process.env.ZAPIER_EXPENSE_WEBHOOK_URL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function webhookFor(type) {
  if (type === 'purchase' && PURCHASE_URL) return PURCHASE_URL;
  if (type === 'expense' && EXPENSE_URL) return EXPENSE_URL;
  return SHARED_URL;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Honeypot: real users leave this empty; bots fill it in.
  if (body.company_url) return res.status(200).json({ ok: true });

  const type = body.type === 'expense' ? 'expense' : (body.type === 'purchase' ? 'purchase' : '');
  const email = String(body.email || '').trim();
  const item = String(body.item || '').trim();
  const amountRaw = String(body.amount == null ? '' : body.amount).trim();

  if (!type) return res.status(400).json({ error: 'type must be "purchase" or "expense"' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid client email is required' });
  if (!item) return res.status(400).json({ error: 'A description of what was purchased is required' });

  // Parse the amount to a number, tolerating currency symbols / thousands separators.
  const amount = parseFloat(amountRaw.replace(/[^0-9.\-]/g, ''));
  if (!amountRaw || isNaN(amount)) return res.status(400).json({ error: 'A valid amount is required' });

  const url = webhookFor(type);
  if (!url) return res.status(500).json({ error: 'Server misconfigured: Zapier webhook URL missing' });

  const payload = {
    report_type: type,
    client_email: email,
    item: item,
    amount: amount,
    amount_raw: amountRaw,
    submitted_at: new Date().toISOString(),
    source_url: req.headers.referer || undefined,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      return res.status(502).json({ error: 'Zapier webhook error', details });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Zapier', message: err.message });
  }
};
