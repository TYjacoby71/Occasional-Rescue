-- Occasion Rescue — seed data (Phase 1)
-- occasion_config drives the dashboard carousel, routing, and holiday date math.
-- MVP ships ANNIVERSARY ONLY (active=true). Flip `active` per occasion when its theme is ready.
-- nth_weekday convention: 'nth_weekday:month,nth,weekday' with weekday 0=Sunday.

insert into occasion_config (type, label, route_slug, date_rule, display_order, needs_gift_target, active) values
  ('anniversary', 'Anniversary',     '/anniversary',  'user',                1, false, true),   -- MVP active
  ('valentines',  'Valentine''s Day','/valentines',   'fixed:02-14',         2, false, false),
  ('mothers_day', 'Mother''s Day',   '/mothers-day',  'nth_weekday:5,2,0',   3, true,  false),  -- May, 2nd Sunday
  ('fathers_day', 'Father''s Day',   '/fathers-day',  'nth_weekday:6,3,0',   4, true,  false),  -- June, 3rd Sunday
  ('birthday',    'Birthday',        '/birthday',     'user',                5, false, false)
on conflict (type) do update set
  label             = excluded.label,
  route_slug        = excluded.route_slug,
  date_rule         = excluded.date_rule,
  display_order     = excluded.display_order,
  needs_gift_target = excluded.needs_gift_target,
  active            = excluded.active;
