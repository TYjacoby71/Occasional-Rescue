-- Occasion Rescue — Phase 5a: catalog enum extensions
--
-- The deliverable catalog is becoming DATA (the new `products` table, 0003). To keep
-- `deliverables.kind` from needing a migration per SKU, we add two COARSE kinds — the fine-grained
-- product is carried by `deliverables.payload.product_slug` (-> products.slug):
--   * 'physical' — any POD / drop-ship physical good (book, framed, canvas, star map, mug, card…)
--   * 'giftcard' — instant digital credit / experience voucher (Tremendous et al.)
--
-- ADD VALUE must land in its own migration: a newly added enum value cannot be USED (e.g. as a
-- column default) in the same transaction. 0003 creates the table that defaults to 'physical'.

alter type deliverable_kind add value if not exists 'physical';
alter type deliverable_kind add value if not exists 'giftcard';
