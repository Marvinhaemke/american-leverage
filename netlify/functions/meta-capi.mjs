// Netlify Function (Functions 2.0): Meta Conversions API (CAPI) bridge
// Receives events from the browser (js/meta-capi.js) and forwards them to
// Meta's CAPI with the same `event_id` used by the Pixel so Meta can
// deduplicate the browser and server events.
//
// Required env vars (set in Netlify → Site configuration → Environment variables):
//   META_ACCESS_TOKEN     - long-lived CAPI access token (REQUIRED, secret)
//   META_PIXEL_ID         - defaults to 953868717628214 if unset
//   META_TEST_EVENT_CODE  - (optional) for the "Test Events" tab in Events Manager

import crypto from 'node:crypto';

const GRAPH_VERSION = 'v19.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

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

function getClientIp(req, context) {
  if (context?.ip) return context.ip;
  const nf = req.headers.get('x-nf-client-connection-ip');
  if (nf) return nf;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return undefined;
}

export default async function handler(req, context) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const PIXEL_ID = process.env.META_PIXEL_ID || '953868717628214';
  const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;

  if (!ACCESS_TOKEN) return json({ error: 'Server misconfigured: META_ACCESS_TOKEN missing' }, 500);

  // navigator.sendBeacon posts a Blob, so don't trust the Content-Type header.
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
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
    return json({ error: 'event_name and event_id are required' }, 400);
  }

  const userData = {
    client_ip_address: getClientIp(req, context),
    client_user_agent: req.headers.get('user-agent') || undefined,
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
    event_source_url: event_source_url || req.headers.get('referer') || undefined,
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
      return json({ error: 'Meta CAPI error', details: result }, response.status);
    }
    return json({ ok: true, meta: result });
  } catch (err) {
    return json({ error: 'Failed to reach Meta CAPI', message: err.message }, 502);
  }
}

export const config = { path: '/api/meta-capi' };
