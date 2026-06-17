# Occasion Rescue — System State

> Snapshot of what the codebase actually does today, plus the wired-vs-stub gaps.
> Companion to `MVP-PLAN.md` (the target) and `../occasionrescuemvpspec.md` (the spec).
> Last reviewed: 2026-06-17.

## Backend status

The Supabase project `occasional-rescue` (ref `gaqddxuphjlypfynjqtu`, org *Node Network*,
us-east-1, free tier) is provisioned and wired:

- **Schema** — `db/migrations/0001_init.sql` applied: 12 tables, enums, indexes, RLS + policies.
- **Seed** — `occasion_config` populated (anniversary active; others staged inactive).
- **Storage** — private `assets` bucket (50 MB/file; image/audio/video MIME types) with
  owner-scoped RLS on `storage.objects` keyed to the `{user_id}/…` path prefix. The service
  role bypasses it for the anonymous draft flow and signed share URLs.
- **Env** — `.env.local` (gitignored) holds the project URL + anon key.
  `SUPABASE_SERVICE_ROLE_KEY` must be pasted from the dashboard; Stripe/Twilio/Resend/LLM/
  Google keys are stubbed empty.

Every server module gates on `isSupabaseConfigured()` / `isStripeConfigured()` and degrades to
dev fallbacks (synthetic ids, paywall bypass, template generation) when keys are absent, so the
flow always runs.

---

## How the funnel works today

All anonymous — no signup. One draft order carries the whole session.

| # | Surface | File | What happens |
|---|---------|------|--------------|
| 1 | Dashboard | `app/page.tsx`, `components/Dashboard.tsx` | Renders occasion tiles from a **static** list (`lib/occasions.ts`). Only **Anniversary** is active; others open a "coming soon" sheet. |
| 2 | Occasion route | `app/[occasion]/page.tsx` | 404s any inactive occasion; else mounts `RescueFlow`. |
| 3 | Rescue flow | `components/RescueFlow.tsx` | On mount → `createDraftOrder()` inserts `orders` row (`user_id NULL`, `status='draft'`) via the **service role** + logs `panic_start`. 5-step intake: name, photos, shared secret, "I love you because…", gift pick + tone. |
| 4 | Generate | `lib/modules/generation.ts`, `lib/modules/intake.ts` | `saveIntake()` → `status='generating'`. `generateDeliverables()` polishes the user's fragments via the **Anthropic API** (`LLM_API_KEY`, default `claude-opus-4-8`) into a "Story of Us", with a deterministic template fallback. Persists to `deliverables` (`status='preview'`). |
| 5 | Preview + paywall | `components/Paywall.tsx`, `lib/modules/payment.ts` | Watermarked preview. Pricing $24/$34/$42 for 1/2/3 gifts. **Dev/no-Stripe** → `markOrderPaidDev()` flips order to `paid`, writes `payments` (`dev_bypass`). **Stripe** → Checkout with `setup_future_usage: off_session` (saves card + reorder consent); the webhook flips the order. |
| 6 | Done | `components/RescueFlow.tsx` (`Done`) | Shows a shareable link + a "remind me next year" toggle. |

**Payments webhook** (`app/api/webhooks/stripe/route.ts`): on `checkout.session.completed`,
marks the order `paid` and writes a `payments` row. Idempotent via `webhook_events(source, event_id)`.

**Analytics**: the `events` table logs `panic_start → intake_complete → generated → paid → shared`.

---

## Gaps — now wired

The six gaps below were stubs/placeholders. All are now implemented. Provider-dependent paths
(SMS/email send) degrade safely when keys are absent and record the attempt either way.

### 1. Photos reach storage ✅
`RescueFlow.addPhotos` keeps a local object URL for the in-session preview AND fires
`uploadAsset()` (`lib/modules/assets.ts`) per file — a service-role server action that uploads
to `assets/{order_id}/{uuid}.{ext}` and writes an `assets` row. The share render fetches 7-day
signed URLs via `signedUrlsForOrder()`.

### 2. Share page ✅
`publishShare()` (`lib/modules/share.ts`) stamps the order with an unguessable `share_slug` +
`share_token`, flips it to `delivered`, and is idempotent on re-send. `app/s/[slug]/page.tsx`
(service-role render, `?t=` token-guarded → 404 on mismatch) composes the order's intake +
deliverables + signed photos into `components/Microsite.tsx`. The Done screen shows the real,
sendable `…/s/{slug}?t={token}` link. *(Still TODO: `/api/og/[slug]` OG image.)*

### 3. Dashboard reads live config ✅
`lib/modules/occasion.ts` `listOccasions()` reads all `occasion_config` rows (service role, so
inactive "coming soon" tiles render too), deriving each tile's date label from `date_rule` via
the date engine. `app/page.tsx` is a server component (ISR, `revalidate = 300`) feeding
`components/Home.tsx`. Falls back to the static list when Supabase isn't configured.

### 4. Auth / profiles ✅ (lead capture)
The schema requires a profile (FK → `auth.users`) before owning an occasion, so reminder opt-in
(`lib/modules/onboarding.ts` `setupReminder()`) creates/reuses an auth user via the admin API,
upserts the `profiles` row + consent timestamps, and claims the anonymous order
(`orders.user_id`). Full login UI remains a later phase, but the profile model is now exercised.

### 5. Reminder engine ✅
`setupReminder()` writes `recipients` + `occasions` (`reminder_opt_in`, computed
`next_occurrence`) + `scheduled_messages` at each `default_lead_days` offset. The
`CRON_SECRET`-guarded sweep (`app/api/cron/sweep/route.ts`) picks due rows, resolves the owner's
contact, and sends via `lib/modules/messaging.ts` (Twilio SMS / Resend email over REST; "skips"
cleanly without keys), logging every attempt to `message_log`.

### 6. Action buttons ✅
"Text it" / "Email it" use real `sms:` / `mailto:` links carrying the share URL. "Download print"
calls `window.print()`. "Order framed" / "Order hardcover" open a prefilled `mailto:` concierge
draft (physical fulfillment is intentionally a mailto handoff for now — no commerce backend).

---

## Build phases

Per `README.md` / `MVP-PLAN.md`: **Phases 0–4** (skeleton, data layer, intake, generation,
payments) plus the share microsite, storage uploads, lead-capture/profiles, and the
lifecycle/reminder engine are now in. Remaining polish: full login UI, the `/api/og/[slug]` OG
image, and physical-product commerce.

## Runtime notes
- `npm run typecheck` and `npm run build` both pass.
- DB-backed paths need `SUPABASE_SERVICE_ROLE_KEY` set; without it everything degrades to dev
  no-ops (synthetic ids, paywall bypass, static carousel) so the UI still runs.
- Reminder sends need `CRON_SECRET` (to call the sweep) and Twilio/Resend keys to actually
  deliver; otherwise the sweep drains the queue and logs `skipped` in `message_log`.
- `lib/database.types.ts` is now generated from the live project (replacing the hand-authored
  stub); regenerate after schema changes.
