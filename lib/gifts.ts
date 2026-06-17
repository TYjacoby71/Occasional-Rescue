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

export type Gift = {
  key: GiftKey;
  label: string;
  desc: string;
  Icon: LucideIcon;
  kind: DeliverableKind; // coarse deliverable_kind stamped on the deliverable
  fulfillment: Fulfillment;
  checkout: Checkout; // 'bundle' = the digital combo paywall; 'order' = its own charge
  minLeadDays: number; // days of runway the event needs before this can ship (0 = instant)
  priceCents: number; // standalone price. Digital 'bundle' items use priceFor() instead.
  shipNote?: string; // shown on the picker, e.g. "Ships in ~7 days" / "Emailed instantly"
};

// Ordered premium-first (mirrors products.display_order). Higher minLeadDays + price lead, so when
// there's runway the best keepsakes sit on top and the tail necks off as the date approaches.
export const GIFTS: Gift[] = [
  {
    key: "photobook", label: "The Keepsake Book",
    desc: "A premium hardcover photo book — your story, printed and bound",
    Icon: BookOpen, kind: "photobook", fulfillment: "print", checkout: "order",
    minLeadDays: 14, priceCents: 8900, shipNote: "Ships in ~10 days",
  },
  {
    key: "starmap", label: "The Star Map",
    desc: "The night sky exactly as it was — your date, your place",
    Icon: Star, kind: "physical", fulfillment: "print", checkout: "order",
    minLeadDays: 10, priceCents: 6900, shipNote: "Ships in ~7 days",
  },
  {
    key: "portrait", label: "The Framed Print",
    desc: "Your words set in a museum-grade frame, ready to hang",
    Icon: Frame, kind: "portrait", fulfillment: "print", checkout: "order",
    minLeadDays: 10, priceCents: 6900, shipNote: "Ships in ~7 days",
  },
  {
    key: "collage", label: "The Canvas Collage",
    desc: "Your favorite moments, printed together on gallery canvas",
    Icon: LayoutGrid, kind: "collage", fulfillment: "print", checkout: "order",
    minLeadDays: 10, priceCents: 5900, shipNote: "Ships in ~7 days",
  },
  {
    key: "mug", label: "The Mug",
    desc: "“Reasons I love you,” in their hands every morning",
    Icon: Coffee, kind: "physical", fulfillment: "print", checkout: "order",
    minLeadDays: 7, priceCents: 2900, shipNote: "Ships in ~5 days",
  },
  {
    key: "card", label: "The Card",
    desc: "A premium greeting card — written by you, mailed to them",
    Icon: Mail, kind: "physical", fulfillment: "print", checkout: "order",
    minLeadDays: 5, priceCents: 1200, shipNote: "Ships in ~4 days",
  },
  {
    key: "experience", label: "The Experience",
    desc: "A dinner, a spa day, a night out — emailed as a voucher",
    Icon: Ticket, kind: "giftcard", fulfillment: "digital", checkout: "order",
    minLeadDays: 2, priceCents: 7500, shipNote: "Emailed instantly",
  },
  {
    key: "giftcard", label: "The Gift Card",
    desc: "A gift card to their favorite place — in their inbox in seconds",
    Icon: Gift, kind: "giftcard", fulfillment: "digital", checkout: "order",
    minLeadDays: 0, priceCents: 5000, shipNote: "Emailed instantly",
  },
  {
    key: "reel", label: "The Reel",
    desc: "Your photos, set to music — sent as a link",
    Icon: Film, kind: "reel", fulfillment: "digital", checkout: "bundle",
    minLeadDays: 0, priceCents: 2400,
  },
  {
    key: "poem", label: "The Poem",
    desc: "Written for them — share it, or print it at home",
    Icon: PenLine, kind: "poem", fulfillment: "digital", checkout: "bundle",
    minLeadDays: 0, priceCents: 2400,
  },
];

export const giftByKey = (k: GiftKey): Gift => GIFTS.find((g) => g.key === k)!;

export const isPrint = (k: GiftKey): boolean => giftByKey(k).fulfillment === "print";

// Does this item carry its own checkout (a real charge), vs. ride the digital bundle paywall?
// True for every print keepsake AND the gift-card / experience commerce items.
export const needsCheckout = (k: GiftKey): boolean => giftByKey(k).checkout === "order";

// The neck-down. Split the catalog by whether the event is far enough out to ship each item.
// `available` stays premium-first; `locked` is what just missed the window (shown greyed, as a
// nudge toward the reminder + "next time"). Instant items (lead 0) are always available.
export function splitByLeadTime(daysUntil: number): { available: Gift[]; locked: Gift[] } {
  const available: Gift[] = [];
  const locked: Gift[] = [];
  for (const g of GIFTS) {
    if (daysUntil >= g.minLeadDays) available.push(g);
    else locked.push(g);
  }
  return { available, locked };
}
