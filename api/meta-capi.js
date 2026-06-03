// Vercel Serverless Function: Meta Conversions API (CAPI) bridge
// Receives events from the browser (js/meta-capi.js) and forwards them to
// Meta's CAPI with the same `event_id` used by the Pixel so Meta can
// deduplicate the browser and server events.
//
// Required env vars (set in Vercel → Project → Settings → Environment Variables):
//   META_ACCESS_TOKEN     - long-lived CAPI access token (REQUIRED, secret)
//   META_PIXEL_ID         - defaults to 953868717628214 if unset
//   META_TEST_EVENT_CODE  - (optional) for the "Test Events" tab in Events Manager

const crypto = require('crypto');

const PIXEL_ID = process.env.META_PIXEL_ID || '953868717628214';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;
const GRAPH_VERSION = 'v19.0';

function sha256(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim().toLowerCase();
  if (!trimmed) return undefined;
  return crypto.createHash('sha256').update(trimmed).digest('hex');
}

function normalizePhone(value) {
  if (!value) return undefined;
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits || undefined;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || undefined;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!ACCESS_TOKEN) return res.status(500).json({ error: 'Server misconfigured: META_ACCESS_TOKEN missing' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const {
    event_name,
    event_id,
    event_source_url,
    action_source = 'website',
    custom_data = {},
    user = {},
    fbp,
    fbc,
  } = body;

  if (!event_name || !event_id) {
    return res.status(400).json({ error: 'event_name and event_id are required' });
  }

  const userData = {
    client_ip_address: getClientIp(req),
    client_user_agent: req.headers['user-agent'],
  };
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const em = sha256(user.email);
  const ph = sha256(normalizePhone(user.phone));
  const fn = sha256(user.first_name || (user.name ? user.name.split(' ')[0] : undefined));
  const ln = sha256(user.last_name || (user.name ? user.name.split(' ').slice(1).join(' ') : undefined));
  const country = sha256(user.country);
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  if (country) userData.country = [country];

  const eventPayload = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id,
    action_source,
    event_source_url: event_source_url || req.headers.referer,
    user_data: userData,
    custom_data,
  };

  const apiBody = { data: [eventPayload] };
  if (TEST_EVENT_CODE) apiBody.test_event_code = TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiBody),
    });
    const result = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Meta CAPI error', details: result });
    }
    return res.status(200).json({ ok: true, meta: result });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Meta CAPI', message: err.message });
  }
};
