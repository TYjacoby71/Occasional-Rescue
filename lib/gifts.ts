import { Film, PenLine, BookOpen, type LucideIcon } from "lucide-react";

// The synthesis deliverables. `key` maps to deliverable_kind (book -> photobook).
export type GiftKey = "reel" | "poem" | "book";

export type Gift = {
  key: GiftKey;
  label: string;
  desc: string;
  Icon: LucideIcon;
  kind: "reel" | "poem" | "photobook"; // deliverable_kind
};

export const GIFTS: Gift[] = [
  { key: "reel", label: "The Reel", desc: "Your photos, set to music", Icon: Film, kind: "reel" },
  { key: "poem", label: "The Poem", desc: "Written for them, as a print", Icon: PenLine, kind: "poem" },
  { key: "book", label: "The Book", desc: "Story of us · ships as hardcover", Icon: BookOpen, kind: "photobook" },
];

export const giftByKey = (k: GiftKey): Gift => GIFTS.find((g) => g.key === k)!;
