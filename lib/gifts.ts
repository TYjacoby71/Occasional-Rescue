import { Film, PenLine, BookOpen, Frame, LayoutGrid, type LucideIcon } from "lucide-react";

// The deliverable catalog. Two fulfillment classes:
//   * digital — generated instantly, sent as a link. Always available, even day-of.
//   * print   — a real print-on-demand keepsake we ship. Needs `minLeadDays` of runway before
//               the event, and is a real (Stripe) order with a shipping address.
//
// The selection step necks DOWN as the event nears: with 3+ weeks we surface the premium print
// products (high margin); inside the ship windows they drop away until only digital remains.
// `key` maps to deliverable_kind.

export type GiftKey = "reel" | "poem" | "photobook" | "portrait" | "collage";
export type Fulfillment = "digital" | "print";

export type Gift = {
  key: GiftKey;
  label: string;
  desc: string;
  Icon: LucideIcon;
  kind: "reel" | "poem" | "photobook" | "portrait" | "collage"; // deliverable_kind
  fulfillment: Fulfillment;
  minLeadDays: number; // days of runway the event needs before this can ship (0 = instant)
  priceCents: number; // standalone price (print). Digital combos use bundle pricing in lib/config.
  shipNote?: string; // shown on print products, e.g. "Ships in ~7 days"
};

// Ordered premium-first. Higher minLeadDays + price sit at the top, so when there's runway the
// best keepsakes lead the list and the tail necks off as the date approaches.
export const GIFTS: Gift[] = [
  {
    key: "photobook", label: "The Keepsake Book",
    desc: "A premium hardcover photo book — your story, printed and bound",
    Icon: BookOpen, kind: "photobook", fulfillment: "print",
    minLeadDays: 21, priceCents: 8900, shipNote: "Ships in ~10 days",
  },
  {
    key: "portrait", label: "The Framed Print",
    desc: "Your poem set in a museum-grade frame, ready to hang",
    Icon: Frame, kind: "portrait", fulfillment: "print",
    minLeadDays: 14, priceCents: 6900, shipNote: "Ships in ~7 days",
  },
  {
    key: "collage", label: "The Canvas Collage",
    desc: "Your favorite moments, printed together on gallery canvas",
    Icon: LayoutGrid, kind: "collage", fulfillment: "print",
    minLeadDays: 10, priceCents: 5900, shipNote: "Ships in ~5 days",
  },
  {
    key: "reel", label: "The Reel",
    desc: "Your photos, set to music — sent as a link",
    Icon: Film, kind: "reel", fulfillment: "digital",
    minLeadDays: 0, priceCents: 2400,
  },
  {
    key: "poem", label: "The Poem",
    desc: "Written for them — share it, or print it at home",
    Icon: PenLine, kind: "poem", fulfillment: "digital",
    minLeadDays: 0, priceCents: 2400,
  },
];

export const giftByKey = (k: GiftKey): Gift => GIFTS.find((g) => g.key === k)!;

export const isPrint = (k: GiftKey): boolean => giftByKey(k).fulfillment === "print";

// The neck-down. Split the catalog by whether the event is far enough out to ship each item.
// `available` stays premium-first; `locked` is what just missed the window (shown greyed, as a
// nudge toward the reminder + "next time"). Digital items are always available.
export function splitByLeadTime(daysUntil: number): { available: Gift[]; locked: Gift[] } {
  const available: Gift[] = [];
  const locked: Gift[] = [];
  for (const g of GIFTS) {
    if (daysUntil >= g.minLeadDays) available.push(g);
    else locked.push(g);
  }
  return { available, locked };
}
