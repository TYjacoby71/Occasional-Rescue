-- Occasion Rescue — MVP schema (Phase 1)
-- Source of truth: occasionrescuemvpspec.md §3, reconciled with the MVP-PLAN.md "synthesis" deltas:
--   * deliverable_kind gains 'reel' and 'poem' (prototype deliverables; microsite is the render shell)
--   * new `events` table for the §9 analytics funnel
--   * orders.share_token is mandatory (guard the public share page; never name-derive the slug)
--   * birthdays: `occasions` drives outreach; `recipients.birthday` is convenience only
--
-- Designed so a new occasion or deliverable type is DATA, not code. Two extension points carry
-- the weight: `occasion_config` (occasions) and `deliverable_kind` + `deliverables.payload`.

------------------------------------------------------------------------------
-- 1. Enums
------------------------------------------------------------------------------
create type occasion_type        as enum ('anniversary','valentines','mothers_day','fathers_day','birthday','other');
create type relationship_type    as enum ('spouse','partner','mother','father','child','friend','other');
create type relationship_status  as enum ('dating','engaged','married','partnered','other');
create type gift_target          as enum ('spouse','parent','other');           -- mothers/fathers day split
create type order_status         as enum ('draft','generating','preview','paid','delivered','failed');
create type tone_type            as enum ('heartfelt','funny','romantic');
-- DELTA: 'reel' + 'poem' added for the synthesis model. 'microsite' is the share-page shell.
create type deliverable_kind     as enum ('microsite','reel','poem','photobook','collage','song','portrait');
create type asset_type           as enum ('photo','audio','video');
create type channel_type         as enum ('sms','email');
create type sched_status         as enum ('pending','sent','cancelled','failed');
create type payment_type         as enum ('order','rush','reminder_upsell','photobook');

------------------------------------------------------------------------------
-- 2. Tables
------------------------------------------------------------------------------

-- Contact / buyer. Starts as a lead (email OR phone only), enriches over time. The contact engine.
create table profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  status                text not null default 'lead',     -- 'lead' | 'customer'
  lead_source           text,                             -- which route/tile captured them
  email                 text,
  phone                 text,
  full_name             text,
  relationship_status   relationship_status,
  -- consent (permission-based outreach; NO spam)
  email_opt_in          boolean not null default false,
  email_opt_in_at       timestamptz,
  sms_opt_in            boolean not null default false,
  sms_opt_in_at         timestamptz,
  offsession_consent    boolean not null default false,   -- consent to charge saved card later (Stripe req)
  offsession_consent_at timestamptz,
  -- payment on file
  stripe_customer_id    text,
  default_pm_id         text,
  pm_brand              text,
  pm_last4              text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Who a gift is for (spouse, mom, dad, kid...). One contact can have many.
create table recipients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null,
  nickname      text,
  relationship  relationship_type not null default 'other',
  birthday      date,   -- convenience only; outreach date math is driven by `occasions`
  created_at    timestamptz not null default now()
);

-- A dated occasion tied to a recipient. THE outreach driver. Add a type = add a market.
create table occasions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  recipient_id    uuid not null references recipients(id) on delete cascade,
  type            occasion_type not null,
  event_date      date,            -- full original date (need the YEAR for "Year Seven" math); NULL for computed holidays
  recurring       boolean not null default true,
  reminder_opt_in boolean not null default false,
  next_occurrence date,            -- maintained by the occasion service
  created_at      timestamptz not null default now(),
  unique (recipient_id, type)
);

-- A rescue / deliverable order. Starts anonymous in the lead flow (user_id null).
create table orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references profiles(id) on delete set null,   -- null while anonymous draft
  recipient_id   uuid references recipients(id) on delete set null,
  occasion_id    uuid references occasions(id) on delete set null,
  occasion_type  occasion_type not null,
  gift_target    gift_target,        -- set for mothers/fathers day (spouse vs your own parent)
  status         order_status not null default 'draft',
  tone           tone_type not null default 'heartfelt',
  rush           boolean not null default false,
  intake         jsonb not null default '{}'::jsonb,   -- prompt answers (denormalized for MVP)
  amount_cents   integer,
  currency       text not null default 'usd',
  share_slug     text unique,        -- public URL: /s/{slug}
  share_token    text,               -- REQUIRED secret guard for the public share page
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  delivered_at   timestamptz
);

create table assets (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  type         asset_type not null default 'photo',
  storage_path text not null,
  source       text not null default 'upload',   -- 'upload' | 'google_picker'
  caption      text,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Generated output. kind + payload = the modular deliverable system.
-- One order may hold many deliverables (reel + poem + book); all are composed into one /s/[slug] microsite.
create table deliverables (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  kind          deliverable_kind not null default 'microsite',
  payload       jsonb not null default '{}'::jsonb,   -- see spec §6.1 for the Story-of-Us shape
  og_image_path text,
  status        order_status not null default 'generating',
  created_at    timestamptz not null default now()
);

create table payments (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references profiles(id) on delete set null,
  order_id                 uuid references orders(id) on delete set null,
  type                     payment_type not null default 'order',
  stripe_payment_intent_id text,
  stripe_payment_method_id text,
  amount_cents             integer not null,
  status                   text not null,
  created_at               timestamptz not null default now()
);

-- Lifecycle engine work queue (reminders + upsells). Permission-gated at send time.
create table scheduled_messages (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles(id) on delete cascade,
  recipient_id        uuid references recipients(id) on delete set null,
  occasion_id         uuid references occasions(id) on delete set null,
  channel             channel_type not null default 'sms',
  template_key        text not null,       -- reminder_14d | reminder_3d | rush_dayof | upsell_holiday
  send_at             timestamptz not null,
  status              sched_status not null default 'pending',
  payload             jsonb not null default '{}'::jsonb,
  provider_message_id text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  unique (occasion_id, template_key, send_at)
);

create table message_log (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete set null,
  channel             channel_type not null,
  to_address          text not null,
  template_key        text,
  body                text,
  provider_message_id text,
  status              text,
  error               text,
  created_at          timestamptz not null default now()
);

-- Drives the dashboard carousel, routing, and holiday date math. New occasion = new row.
create table occasion_config (
  type              occasion_type primary key,
  label             text not null,
  route_slug        text not null,        -- '/valentines', etc.
  date_rule         text not null,        -- 'user' | 'fixed:MM-DD' | 'nth_weekday:month,nth,weekday'
  default_lead_days integer[] not null default '{14,3}',
  display_order     integer not null default 0,    -- carousel order
  needs_gift_target boolean not null default false, -- true for mothers/fathers day
  active            boolean not null default true
);

create table webhook_events (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,             -- 'stripe' | 'twilio'
  event_id    text not null,
  type        text,
  payload     jsonb,
  processed   boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (source, event_id)
);

-- DELTA: analytics funnel home (spec §9). The north-star (panic_start -> shared) lives here.
create table events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references orders(id) on delete set null,
  user_id    uuid references profiles(id) on delete set null,
  name       text not null,   -- panic_start | intake_complete | generated | preview_viewed | paid | shared | onboard_complete | reminder_sent | reorder
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- 3. Indexes (hot paths: ownership lookups, share render, cron sweep)
------------------------------------------------------------------------------
create index on recipients (user_id);
create index on occasions (user_id);
create index on occasions (recipient_id);
create index on occasions (next_occurrence) where reminder_opt_in;
create index on orders (user_id);
create index on orders (occasion_id);
create index on assets (order_id);
create index on deliverables (order_id);
create index on payments (order_id);
create index on scheduled_messages (status, send_at);
create index on events (name, created_at);

------------------------------------------------------------------------------
-- 4. Row Level Security
--   * User-owned tables: owner-only via auth.uid().
--   * Pre-payment (anonymous) drafts have user_id NULL and are reached ONLY through
--     server actions using the service role (which bypasses RLS) + a signed session cookie.
--   * occasion_config: public read of active rows (drives the carousel).
--   * Server-only tables (webhook_events, events): no client policies -> service role only.
------------------------------------------------------------------------------
alter table profiles            enable row level security;
alter table recipients          enable row level security;
alter table occasions           enable row level security;
alter table orders              enable row level security;
alter table assets              enable row level security;
alter table deliverables        enable row level security;
alter table payments            enable row level security;
alter table scheduled_messages  enable row level security;
alter table message_log         enable row level security;
alter table occasion_config     enable row level security;
alter table webhook_events      enable row level security;
alter table events              enable row level security;

-- profiles: a row IS the user
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- direct user_id ownership
create policy recipients_owner on recipients
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy occasions_owner on occasions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy orders_owner on orders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy payments_owner on payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy scheduled_messages_owner on scheduled_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy message_log_owner on message_log
  for select using (user_id = auth.uid());

-- assets + deliverables: ownership flows through the parent order
create policy assets_via_order on assets
  for all
  using (exists (select 1 from orders o where o.id = assets.order_id and o.user_id = auth.uid()))
  with check (exists (select 1 from orders o where o.id = assets.order_id and o.user_id = auth.uid()));
create policy deliverables_via_order on deliverables
  for all
  using (exists (select 1 from orders o where o.id = deliverables.order_id and o.user_id = auth.uid()))
  with check (exists (select 1 from orders o where o.id = deliverables.order_id and o.user_id = auth.uid()));

-- occasion_config: anyone may read active rows (carousel is public)
create policy occasion_config_public_read on occasion_config
  for select using (active);

-- webhook_events + events: no policies -> only the service role can touch them.
