# Occasion Rescue — MVP Implementation Plan

> Companion to `occasionrescuemvpspec.md`. Where this doc and the spec disagree, this doc's
> **synthesis model** wins (the spec's §6 / enums are being reconciled toward it).

## 0. The synthesis (resolves the spec-vs-prototype gap)

The prototype sells **Reel / Poem / Book**; the spec's primary deliverable is a **microsite**.
These are reconciled as:

```
order ──< deliverables (kind: reel | poem | photobook)
              └─ each rendered as a section inside ONE themed microsite at /s/[slug]
```

- `deliverable_kind` gains **`reel`** and **`poem`**. `microsite` stays as the share-page *shell*, not a stored row.
- One order → many deliverables. Bundle pricing (`$24 / $34 / $42` for 1/2/3) lives on `orders.amount_cents`.
- The share page composes the order's deliverables into one scrollable themed page.

## 1. Repo structure (target)

```
/app
  page.tsx                         dashboard carousel (occasion_config driven)
  /[occasion]/page.tsx             lead intake flow (anniversary live; others "coming soon")
  /s/[slug]/page.tsx               public share microsite (service-role render, no auth)
  /api/og/[slug]/route.tsx         dynamic OG image (next/og)
  /api/webhooks/stripe/route.ts
  /api/webhooks/twilio/route.ts
  /api/cron/sweep/route.ts         daily reminder sweep (CRON_SECRET guarded)
/lib
  /supabase/{server,client,service}.ts
  /modules/{intake,generation,payment,share,occasion,scheduling,messaging,upsell,analytics}.ts
  /occasion/date-rules.ts          date_rule parser (user | fixed:MM-DD | nth_weekday:m,n,w)
/db/migrations/*.sql               §3 schema + §2 deltas
/db/seed.sql                       occasion_config seed
/components/...                    ported from prototype.jsx
```

The spec §7 "thin module" list maps 1:1 to `/lib/modules/*` — build the seams now, even as stubs.

## 2. Data-model deltas (applied in db/migrations/0001_init.sql)

1. `deliverable_kind` += `reel`, `poem`.
2. New `events` table for the §9 funnel (north-star: `panic_start → shared`).
3. `orders.share_token` is a mandatory random secret (never name-derive the slug — the prototype's
   guessable slug is a privacy bug; the build follows the spec here).
4. Birthdays: `occasions` drives outreach; `recipients.birthday` is convenience only.
5. `event_date` stays a full `date` (need the year for "Year Seven" anniversary math).

## 3. Phases (maps to spec §8, reconciled)

| Phase | Scope | Acceptance |
|---|---|---|
| **0 — Infra** ✅ | Next.js+Vercel skeleton, Supabase clients (anon/server/service), env (§10). | Skeleton deploys & connects. |
| **1 — Data layer** ✅ | §3 migrations + §2 deltas, RLS, seed, typed client stub. | RLS verified (A can't read B); seed present; `events` exists. |
| **2 — Dashboard + lead intake** | Carousel from `occasion_config`; gift-target sheet; 5-step intake → draft order + assets, **no signup**. All pre-pay I/O via server actions + service role + signed cookie. | Tap tile → draft order + assets, no signup. |
| **3 — Generation + preview** | Per-kind generators (Reel/Poem/Book); LLM "polish only, never invent" prompt; watermarked preview. | Intake → watermarked preview <10s perceived. |
| **4 — Payments** | Stripe customer + SetupIntent + PaymentIntent + bundle price + rush + off-session consent + idempotent webhook. | Test card pays, card saved, order `paid`, consent stored. |
| **5 — Public share microsite** | `/s/[slug]` via service role, slug+token guard; compose deliverables; reveal; dynamic OG; deliver by SMS/email. | Recipient opens link (no auth), OG renders in a text. |
| **6 — Onboarding / enrichment** | Post-purchase lead→customer: relationship, spouse, dates, channel opt-ins w/ `*_opt_in_at`. | Opted-in occasions exist with `next_occurrence`. |
| **7 — Scheduling + messaging** | A2P 10DLC; daily cron → `scheduled_messages`; dispatcher; STOP/HELP; `message_log`. | Test occasion in window sends one SMS; STOP suppresses. |
| **8 — Upsell / one-tap reorder** | 14d/3d/day-of templates; `YES` → off-session charge → clone intake → generate → deliver. | Reply YES charges saved card + delivers, no re-intake. |
| 9 — Occasion routes | `/valentines`, `/mothers-day`, `/fathers-day`, `/birthday` themes; flip `active`. | Each route runs full flow with correct dates + theme. |
| 10 — Photobook fulfillment | POD integration for `deliverable_kind='photobook'`. | A paid book creates a fulfillment order. |
| 11 — Ops + analytics | Order/message dashboard; alerting; funnel + north-star. | Funnel observable end to end. |

Phases 0–8 = shippable MVP.

## 4. Decisions baked in

- **Brand name** → single config constant; "Occasion Rescue" (fix README's "Occasional").
- **Reel audio** → relabel from "Your song" to avoid colliding with the deferred custom-song premium.
- **Pricing** → bundle tiers `$24/$34/$42` are canonical; spec's "$19.99" reminder copy updates to match.
- **Anonymous flow** → server-action/service-role mediated, not "direct client reads" (RLS can't see `user_id IS NULL`).
- **Authenticity** → generation omits rather than invents; minimum-input gating before generate.

## Phase 1 verification (how to prove "done")

Once a Supabase project is connected:
1. `psql < db/migrations/0001_init.sql` then `psql < db/seed.sql` (or run via Supabase SQL editor / `apply_migration`).
2. RLS check: sign in as user A, confirm a SELECT on user B's `orders` returns 0 rows.
3. `select count(*) from occasion_config where active;` → 1 (anniversary).
4. Regenerate `lib/database.types.ts` via `supabase gen types typescript`.
