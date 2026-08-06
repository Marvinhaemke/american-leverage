# American Leverage — Landing Page

Static landing page for **American Leverage** with Meta Pixel + Conversions API (CAPI)
tracking, designed to be hosted on **Netlify** (zero build step).

## Structure

```
index.html                      # Landing page (Tailwind via CDN, no build needed)
js/meta-capi.js                 # Browser helper: fires Pixel + CAPI events with a shared event_id
netlify/functions/meta-capi.mjs # Serverless function: forwards events to Meta CAPI  (/api/meta-capi)
netlify/functions/reporting.mjs # Serverless function: forwards reports to Zapier    (/api/reporting)
reporting/                      # Purchase / expense report forms
images/                         # Page assets
netlify.toml                    # Publish dir, function routing, headers
```

The functions use the [Netlify Functions 2.0](https://docs.netlify.com/functions/get-started/)
API (`export default async (req, context) => Response`). Each one declares its own
public path via `export const config = { path: '/api/...' }`, and `netlify.toml`
also rewrites `/api/*` → `/.netlify/functions/:splat` as a fallback — so the browser
URLs are unchanged from the previous hosting setup.

Clean URLs (`/terms-of-use` → `terms-of-use.html`) are Netlify's default behaviour,
so no config is needed for them.

## Meta tracking

- **Pixel ID:** `953868717628214` (embedded in `index.html`; safe to be public).
- **CAPI:** browser and server events share an `event_id` so Meta **deduplicates** them.
- A `Lead` event fires when a visitor clicks an "Apply for Services" CTA.

## Environment variables (set in Netlify — do NOT commit)

| Variable | Required | Notes |
|---|---|---|
| `META_ACCESS_TOKEN` | ✅ | Long-lived CAPI access token (**secret**). |
| `META_PIXEL_ID` | optional | Defaults to `953868717628214`. |
| `META_TEST_EVENT_CODE` | optional | For the Events Manager "Test Events" tab. |
| `ZAPIER_REPORTING_WEBHOOK_URL` | ✅ | Zapier Catch Hook URL for the reporting forms (**secret**). |
| `ZAPIER_PURCHASE_WEBHOOK_URL` | optional | Overrides the shared URL for purchase reports. |
| `ZAPIER_EXPENSE_WEBHOOK_URL` | optional | Overrides the shared URL for expense reports. |

Set them in **Netlify → Site configuration → Environment variables**, then redeploy.
Secrets are intentionally **not** stored in this repo.

## Deploy

1. Import this repo into Netlify (Add new site → Import an existing project).
2. Netlify reads `netlify.toml`: no build command, publish directory `.`,
   functions in `netlify/functions`.
3. Add the environment variables above.
4. Deploy. Subsequent pushes to the default branch auto-deploy.

## Local development

```bash
npm i -g netlify-cli
netlify dev    # serves the static site and runs /api/meta-capi + /api/reporting locally
```

Put local secrets in `.env` (git-ignored); `netlify dev` loads it automatically.
