# Occasion Rescue — Launch Guide

Everything required to take the app from this repo to a live, installable product.
Grouped by what each piece powers, with **required** vs **optional** flagged. The app degrades
gracefully — without the optional integrations it still runs (templates instead of AI, concierge
fulfillment instead of auto-print, etc.).

---

## 1. Environment variables

Set these in your host's environment settings (Vercel/Netlify dashboard, or `.env.local` for local
dev). `NEXT_PUBLIC_*` values are exposed to the browser; everything else is server-only — **never**
expose a service-role or secret key to the client.

### 🟥 Core — required for the app to function
| Variable | Public? | Purpose | Where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Database / API URL | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Client database key | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Server-only DB key (share page, crons, writes) | same page |
| `APP_BASE_URL` | server | Your public URL (e.g. `https://yourapp.com`); builds Stripe redirect + share links | your deployed domain |

### 🟧 Payments — required for the paid / checkout flow
| Variable | Public? | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | **secret** | Server-side Stripe API calls |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | Client-side Stripe |
| `STRIPE_WEBHOOK_SECRET` | **secret** | Verifies events at `/api/webhooks/stripe` |

### 🟨 AI generation — optional (falls back to deterministic templates if absent)
| Variable | Public? | Purpose |
|---|---|---|
| `LLM_API_KEY` | **secret** | Anthropic API key — powers the Story polish + Poem generation/reworks |
| `LLM_MODEL` | server | Optional model override (defaults to `claude-opus-4-8`) |

### 🟦 Reminders & sending — optional (needed for SMS / email)
| Variable | Public? | Purpose |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | **secret** | SMS reminders |
| `TWILIO_AUTH_TOKEN` | **secret** | SMS reminders |
| `TWILIO_MESSAGING_SERVICE_SID` | **secret** | SMS reminders |
| `RESEND_API_KEY` | **secret** | Email reminders / delivery |
| `REMINDER_FROM_EMAIL` | server | Verified Resend "from" address |

### 🟩 Print fulfillment — optional (without it, print orders queue for manual/concierge fulfillment)
| Variable | Public? | Purpose |
|---|---|---|
| `PRODIGI_API_KEY` | **secret** | Auto-submits paid print keepsakes to Prodigi |
| `PRODIGI_API_BASE` | server | Optional; defaults to `https://api.sandbox.prodigi.com` |

### ⬜ Cron / misc
| Variable | Public? | Purpose |
|---|---|---|
| `CRON_SECRET` | **secret** | Guards the `/api/cron/sweep` reminder job |

### Documented but NOT yet wired in code (skip for now)
- `GOOGLE_PHOTOS_CLIENT_ID` / `GOOGLE_PHOTOS_CLIENT_SECRET` — present in `.env.example`, but no code
  reads them yet. The photo step is direct file upload today.
- **Tremendous** (gift-card / Experience supplier, referenced in the catalog) has **no env var wired
  yet** — that fulfillment path isn't built, so there's nothing to set.
- Do **not** set `NODE_ENV` — the host sets it automatically.

---

## 2. Copy-paste checklist

```bash
# ── Core (required) ─────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_BASE_URL=

# ── Payments (required for checkout) ────────────────────────────
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# ── AI generation (optional; templates used if blank) ───────────
LLM_API_KEY=
LLM_MODEL=

# ── Reminders & sending (optional) ──────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
RESEND_API_KEY=
REMINDER_FROM_EMAIL=

# ── Print fulfillment (optional) ────────────────────────────────
PRODIGI_API_KEY=
PRODIGI_API_BASE=

# ── Cron (optional) ─────────────────────────────────────────────
CRON_SECRET=
```

**Minimum for a working live demo:** the 4 Core + 3 Payments variables (add `LLM_API_KEY` for real
AI poems instead of templates). Everything else can be added later.

---

## 3. External setup beyond variables

These are required for a real deployment but aren't environment variables:

1. **Deploy to an HTTPS host** (Vercel/Netlify). HTTPS is also required for the PWA install tile to
   work on phones.
2. **Supabase migrations** — apply the `db/migrations` schema to your database. (The current live
   Supabase project already has them.)
3. **Stripe webhook** — register an endpoint at `https://yourapp.com/api/webhooks/stripe`, then put
   its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. **Resend** — verify your sending domain so `REMINDER_FROM_EMAIL` is allowed to send.
5. **Twilio** — complete A2P 10DLC registration before SMS will deliver.
6. **Cron scheduler** — something (e.g. Vercel Cron) must hit `/api/cron/sweep` on a schedule,
   passing `CRON_SECRET`.

---

## 4. Mobile & PWA (already built)

- The UI is mobile-first: a single centered phone-width column (`maxWidth: 430`), large touch
  targets, explicit `device-width` viewport with `viewport-fit: cover` and a dark `theme-color`.
- The app is an installable PWA (Web App Manifest + brand icons + service worker). On Android/Chrome
  it offers "Install app"; on iOS, Share → Add to Home Screen launches it full-screen.
- **Installability requires HTTPS** — it only becomes installable once deployed to a public HTTPS URL
  (step 3.1 above). Nothing else to configure.

---

## 5. Build & run

```bash
npm install
npm run dev      # local dev at http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run typecheck
npm run lint
```
