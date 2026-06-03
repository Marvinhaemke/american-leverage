# American Leverage — Landing Page

Static landing page for **American Leverage** with Meta Pixel + Conversions API (CAPI)
tracking, designed to be hosted on **Vercel** (zero build step).

## Structure

```
index.html        # Landing page (Tailwind via CDN, no build needed)
js/meta-capi.js    # Browser helper: fires Pixel + CAPI events with a shared event_id
api/meta-capi.js   # Vercel serverless function: forwards events to Meta CAPI
images/            # Page assets
vercel.json        # cleanUrls config
```

## Meta tracking

- **Pixel ID:** `953868717628214` (embedded in `index.html`; safe to be public).
- **CAPI:** browser and server events share an `event_id` so Meta **deduplicates** them.
- A `Lead` event fires when a visitor clicks an "Apply for Services" CTA.

### Required environment variable (set in Vercel — do NOT commit)

| Variable | Required | Notes |
|---|---|---|
| `META_ACCESS_TOKEN` | ✅ | Long-lived CAPI access token (**secret**). |
| `META_PIXEL_ID` | optional | Defaults to `953868717628214`. |
| `META_TEST_EVENT_CODE` | optional | For the Events Manager "Test Events" tab. |

Set it in **Vercel → Project → Settings → Environment Variables**, then redeploy.
The access token is intentionally **not** stored in this repo.

## Deploy

1. Import this repo into Vercel (Add New → Project → Import Git Repository).
2. Framework preset: **Other** (no build command, output is the repo root).
3. Add the `META_ACCESS_TOKEN` environment variable.
4. Deploy. Subsequent pushes to the default branch auto-deploy.

## Local development

```bash
npm i -g vercel
vercel dev    # serves the static site and runs /api/meta-capi locally
```
