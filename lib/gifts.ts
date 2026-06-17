import {
  Film, PenLine, BookOpen, Frame, LayoutGrid, Star, Coffee, Mail, Gift, Ticket,
  type LucideIcon,
} from "lucide-react";
import type { DeliverableKind } from "@/lib/database.types";

// The deliverable catalog — the CLIENT mirror of the `products` table (db/migrations/0003).
// The table is the source of truth: money and supplier fulfillment always resolve server-side
// (lib/modules/catalog.ts) so a client-sent price is never trusted. This mirror exists only so the
// picker + previews render instantly without a round-trip. Keep the two in sync (slug, price,
// minLeadDays). Three fulfillment classes:
//   * digital + bundle — reel/poem. Generated instantly, sent as a link. Priced as a combo
//                        (lib/config priceFor). Always available, even day-of.
//   * digital + order  — gift card / experience. Its own Stripe charge; delivered as an emailed
//                        code/voucher via a commerce supplier (Tremendous). No shipping address.
//   * print   + order  — a real print-on-demand keepsake we ship. Needs `minLeadDays` of runway and
//                        a shipping address; fulfilled by a POD supplier (Prodigi).
// The picker necks DOWN as the event nears: premium keepsakes lead when there's runway, then drop
// away until only the instant tier remains. `key` == products.slug.

export type GiftKey =
  | "photobook" | "starmap" | "portrait" | "collage"
  | "mug" | "card" | "experience" | "giftcard" | "reel" | "poem";
export type Fulfillment = "digital" | "print";
export type Checkout = "bundle" | "order";

// Presentation tier — how the picker groups items by time-to-event. Purely a CLIENT grouping;
// the server gate is still `minLeadDays`. As the date nears, later tiers neck off item-by-item.
//   * imminent     — digital, lead 0. Done the moment you finish. (Poem is the free-to-try hook.)
//   * quick        — off-the-shelf print, ready in ~5–10 days.
//   * personalized — bespoke keepsakes, worth the ~10–30 day wait.
export type Tier = "imminent" | "quick" | "personalized";

export type Gift = {
  key: GiftKey;
  label: string;
  desc: string;
  Icon: LucideIcon;
  kind: DeliverableKind; // coarse deliverable_kind stamped on the deliverable
  fulfillment: Fulfillment;
  checkout: Checkout; // 'bundle' = the digital combo paywall; 'order' = its own charge
  tier: Tier; // picker grouping (client-only)
  minLeadDays: number; // days of runway the event needs before this can ship (0 = instant)
  priceCents: number; // standalone price. Digital 'bundle' items use priceFor() instead.
  shipNote?: string; // shown on the picker, e.g. "Ships in ~7 days" / "Emailed instantly"
};

// Tier headers, in the order the picker stacks them (personalized first when there's runway).
export const TIERS: { key: Tier; label: string; blurb: string }[] = [
  { key: "personalized", label: "Worth the wait", blurb: "Bespoke keepsakes · about 10–30 days" },
  { key: "quick", label: "A few days out", blurb: "Printed & shipped · ready in 5–10 days" },
  { key: "imminent", label: "Ready right now", blurb: "Digital · done the moment you finish" },
];

// Ordered premium-first (mirrors products.display_order). Higher minLeadDays + price lead, so when
// there's runway the best keepsakes sit on top and the tail necks off as the date approaches.
export const GIFTS: Gift[] = [
  // ── Personalized — bespoke keepsakes, worth the wait (~10–30 days) ──
  {
    key: "photobook", label: "The Keepsake Book",
    desc: "A premium hardcover photo book — your story, printed and bound",
    Icon: BookOpen, kind: "photobook", fulfillment: "print", checkout: "order",
    tier: "personalized", minLeadDays: 14, priceCents: 8900, shipNote: "Ships in ~10 days",
  },
  {
    key: "starmap", label: "The Star Map",
    desc: "The night sky exactly as it was — your date, your place",
    Icon: Star, kind: "physical", fulfillment: "print", checkout: "order",
    tier: "personalized", minLeadDays: 12, priceCents: 6900, shipNote: "Ships in ~9 days",
  },
  {
    key: "collage", label: "The Canvas Collage",
    desc: "Your favorite moments, printed together on gallery canvas",
    Icon: LayoutGrid, kind: "collage", fulfillment: "print", checkout: "order",
    tier: "personalized", minLeadDays: 10, priceCents: 5900, shipNote: "Ships in ~7 days",
  },
  // ── Quick — off-the-shelf print, ready in 5–10 days ──
  {
    key: "portrait", label: "The Framed Print",
    desc: "Your words set in a museum-grade frame, ready to hang",
    Icon: Frame, kind: "portrait", fulfillment: "print", checkout: "order",
    tier: "quick", minLeadDays: 7, priceCents: 6900, shipNote: "Ships in ~5 days",
  },
  {
    key: "mug", label: "The Mug",
    desc: "“Reasons I love you,” in their hands every morning",
    Icon: Coffee, kind: "physical", fulfillment: "print", checkout: "order",
    tier: "quick", minLeadDays: 7, priceCents: 2900, shipNote: "Ships in ~5 days",
  },
  {
    key: "card", label: "The Card",
    desc: "A premium greeting card — written by you, mailed to them",
    Icon: Mail, kind: "physical", fulfillment: "print", checkout: "order",
    tier: "quick", minLeadDays: 5, priceCents: 1200, shipNote: "Ships in ~4 days",
  },
  // ── Imminent — digital, done the moment you finish (lead 0) ──
  {
    key: "experience", label: "The Experience",
    desc: "A dinner, a spa day, a night out — emailed as a voucher",
    Icon: Ticket, kind: "giftcard", fulfillment: "digital", checkout: "order",
    tier: "imminent", minLeadDays: 0, priceCents: 7500, shipNote: "Emailed instantly",
  },
  {
    key: "giftcard", label: "The Gift Card",
    desc: "A gift card to their favorite place — in their inbox in seconds",
    Icon: Gift, kind: "giftcard", fulfillment: "digital", checkout: "order",
    tier: "imminent", minLeadDays: 0, priceCents: 5000, shipNote: "Emailed instantly",
  },
  {
    key: "reel", label: "The Reel",
    desc: "Your photos, set to music — sent as a link",
    Icon: Film, kind: "reel", fulfillment: "digital", checkout: "bundle",
    tier: "imminent", minLeadDays: 0, priceCents: 2400,
  },
  {
    key: "poem", label: "The Poem",
    desc: "Written for them — free to try, then unlock to send",
    Icon: PenLine, kind: "poem", fulfillment: "digital", checkout: "bundle",
    tier: "imminent", minLeadDays: 0, priceCents: 2400,
  },
];

export const giftByKey = (k: GiftKey): Gift => GIFTS.find((g) => g.key === k)!;

// Items in a tier, premium-first (GIFTS order). Used by the picker to render each tier section.
export const giftsByTier = (t: Tier): Gift[] => GIFTS.filter((g) => g.tier === t);

export const isPrint = (k: GiftKey): boolean => giftByKey(k).fulfillment === "print";

// Does this item carry its own checkout (a real charge), vs. ride the digital bundle paywall?
// True for every print keepsake AND the gift-card / experience commerce items.
export const needsCheckout = (k: GiftKey): boolean => giftByKey(k).checkout === "order";

// The neck-down is rendered per-tier in the picker: within each tier an item is offered when
// `daysUntil >= minLeadDays`, otherwise shown greyed as a "next time" nudge. Instant items
// (lead 0) are always available.
export const isAvailable = (k: GiftKey, daysUntil: number): boolean =>
  daysUntil >= giftByKey(k).minLeadDays;
