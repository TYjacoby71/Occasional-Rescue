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

## Gaps — looks done, isn't wired

These are the seams that exist as stubs or placeholders. Ordered roughly by user impact.

### 1. Photos never reach storage
Intake stores photos as `URL.createObjectURL(file)` — browser-only blob URLs
(`RescueFlow.tsx` `addPhotos`). Nothing uploads to the `assets` bucket or writes the `assets`
table. The bucket is ready but unused.
**Needed:** an upload step (client → signed upload URL or server action) writing to
`assets/{order_id}/…`, plus `assets` rows with `storage_path`. Blob URLs die on refresh and
can't render in the share page.

### 2. No share page
The "Done" screen shows a fake `oc.rs/{slug}` link; the slug is generated client-side
(`makeShareSlug()`) and **never saved** to `orders.share_slug` / `orders.share_token`. There is
no `/s/[slug]` route. A "sent" gift is not actually viewable by anyone.
**Needed:** persist `share_slug` + `share_token` on the order; build `app/s/[slug]/page.tsx`
(service-role render, token-guarded) composing the order's deliverables into one themed
microsite; signed URLs for `assets`. (`MVP-PLAN.md` also calls for `/api/og/[slug]` OG images.)

### 3. Dashboard reads static data
`lib/occasions.ts` is a hardcoded mirror of the seed, not a live read of `occasion_config`.
**Needed:** `SELECT * FROM occasion_config WHERE active ORDER BY display_order` (Phase 2),
plus day-of preselect via the `date_rule` engine in `lib/occasion/date-rules.ts`.

### 4. No auth / no profiles
`profiles` and all per-user RLS policies exist but are unused — everything runs anonymously
through the service role. There is no signup, login, or post-purchase account claim.
**Needed:** Supabase Auth + an onboarding step that claims the anonymous order (`user_id` set
from `auth.uid()`), enabling reminders and reorders.

### 5. Reminders are local-state only
The "remind me next year" toggle writes nothing. `scheduled_messages` + the cron sweep
(`/api/cron/sweep`, `CRON_SECRET`) and the Twilio/Resend senders are unbuilt and unconfigured.
**Needed:** on opt-in, write `occasions` (`reminder_opt_in`, `next_occurrence`) +
`scheduled_messages`; a daily `CRON_SECRET`-guarded sweep; messaging modules + provider keys.

### 6. Placeholder action buttons
"Text it", "Email it", "Download print", "Order framed", "Order hardcover" are non-functional
(`SecondaryBtn` with no handler).

---

## Build phases

Per `README.md` / `MVP-PLAN.md`: **Phases 0–4** (skeleton, data layer, intake, generation,
payments) are in. Remaining: the share microsite, storage uploads, auth/onboarding, and the
lifecycle/reminder engine.
