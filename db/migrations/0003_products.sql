-- Occasion Rescue — Phase 5b: the drop-ship catalog as data
--
-- `products` is the source of truth for the deliverable menu: price, lead time (the neck-down),
-- and which supplier fulfills it. The client renders a mirror for speed (lib/gifts.ts), but money
-- and fulfillment ALWAYS resolve here server-side (never trust a client-sent price or lead time).
--
-- Adding a SKU is now a single INSERT — no schema change. `deliverable_kind` stays coarse
-- ('physical' | 'giftcard' | 'reel' | 'poem' …); the specific SKU is `slug`.

create table products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,            -- stable catalog key (matches client GiftKey)
  name             text not null,
  blurb            text not null default '',
  fulfillment      text not null,                   -- 'digital' | 'print'
  deliverable_kind deliverable_kind not null default 'physical',  -- what to stamp on deliverables.kind
  supplier         text,                            -- 'prodigi' | 'tremendous' | null (self/digital)
  supplier_sku     text,                            -- provider product/sku id
  price_cents      integer not null,
  min_lead_days    integer not null default 0,      -- runway the event needs before this can ship
  ship_note        text,                            -- 'Ships in ~7 days' | 'Emailed instantly'
  display_order    integer not null default 0,      -- premium-first ordering in the picker
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create index on products (active, display_order);

alter table products enable row level security;
-- Public, read-only catalog (anonymous rescue flow reads it). Writes are service-role only.
create policy products_public_read on products for select using (active);

-- ── Seed: 10 SKUs, premium-first, spanning the three fulfillment tiers ──────────────────────────
-- Supplier SKUs are Prodigi global placeholders; confirm against the live Prodigi catalog before
-- enabling auto-fulfillment. Prices are retail (what the buyer pays).
insert into products (slug, name, blurb, fulfillment, deliverable_kind, supplier, supplier_sku, price_cents, min_lead_days, ship_note, display_order) values
  -- Personalized keepsakes — worth the wait (~10–30d) ─────────────────────────────
  ('photobook', 'The Keepsake Book',  'A premium hardcover photo book — your story, printed and bound',      'print',   'photobook', 'prodigi', 'GLOBAL-PHO-BOOK-A4P', 8900, 14, 'Ships in ~10 days', 10),
  ('starmap',   'The Star Map',       'The night sky exactly as it was — your date, your place',             'print',   'physical',  'prodigi', 'GLOBAL-FAP-16X24',    6900, 12, 'Ships in ~9 days',  20),
  ('collage',   'The Canvas Collage', 'Your favorite moments, printed together on gallery canvas',           'print',   'collage',   'prodigi', 'GLOBAL-CAN-16X20',    5900, 10, 'Ships in ~7 days',  30),
  -- Quick off-the-shelf print (5–10d) ─────────────────────────────────────────────
  ('portrait',  'The Framed Print',   'Your words set in a museum-grade frame, ready to hang',               'print',   'portrait',  'prodigi', 'GLOBAL-FAP-12X16',    6900,  7, 'Ships in ~5 days',  40),
  ('mug',       'The Mug',            '“Reasons I love you,” in their hands every morning',                  'print',   'physical',  'prodigi', 'GLOBAL-MUG-11OZ',     2900,  7, 'Ships in ~5 days',  50),
  ('card',      'The Card',           'A premium greeting card — written by you, mailed to them',            'print',   'physical',  'prodigi', 'GLOBAL-GRE-A5',       1200,  5, 'Ships in ~4 days',  60),
  -- Imminent — digital, done the moment you finish (lead 0) ───────────────────────
  ('experience','The Experience',     'A dinner, a spa day, a night out — emailed as a voucher',             'digital', 'giftcard',  'tremendous', null,             7500,  0, 'Emailed instantly', 70),
  ('giftcard',  'The Gift Card',      'A gift card to their favorite place — in their inbox in seconds',     'digital', 'giftcard',  'tremendous', null,             5000,  0, 'Emailed instantly', 80),
  ('reel',      'The Reel',           'Your photos, set to music — sent as a link',                          'digital', 'reel',      null,         null,             2400,  0, 'Sent as a link',    90),
  ('poem',      'The Poem',           'Written for them — free to try, then unlock to send',                 'digital', 'poem',      null,         null,             2400,  0, 'Sent as a link',   100);
