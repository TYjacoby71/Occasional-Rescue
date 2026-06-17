import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/config";
import type { ProductRow } from "@/lib/database.types";

// The catalog as DATA. `products` (db/migrations/0003) is the source of truth for price, lead time,
// and which supplier fulfills a SKU. Money and fulfillment ALWAYS resolve here server-side — the
// client mirror (lib/gifts.ts) is for rendering only and its prices are never trusted.
//
// When Supabase isn't configured (pure local dev) we fall back to a small static table so the demo
// flow still prices correctly; supplier SKUs there are illustrative and never hit a real supplier.

export type Product = ProductRow;

// Lean dev fallback — mirrors the seed in db/migrations/0003. Keep slugs/prices in sync.
const FALLBACK: Record<string, Product> = mkFallback();

export async function getProduct(slug: string): Promise<Product | null> {
  if (!slug) return null;
  if (!isSupabaseConfigured()) return FALLBACK[slug] ?? null;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return (data as Product | null) ?? FALLBACK[slug] ?? null;
}

export async function listProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    return Object.values(FALLBACK).sort((a, b) => a.display_order - b.display_order);
  }
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("display_order");
  return (data as Product[] | null) ?? Object.values(FALLBACK);
}

function mkFallback(): Record<string, Product> {
  const base = { active: true, created_at: "", id: "" };
  const rows: Array<Omit<Product, "active" | "created_at" | "id">> = [
    { slug: "photobook",  name: "The Keepsake Book",  blurb: "", fulfillment: "print",   deliverable_kind: "photobook", supplier: "prodigi",    supplier_sku: "GLOBAL-PHO-BOOK-A4P", price_cents: 8900, min_lead_days: 14, ship_note: "Ships in ~10 days", display_order: 10 },
    { slug: "starmap",    name: "The Star Map",       blurb: "", fulfillment: "print",   deliverable_kind: "physical",  supplier: "prodigi",    supplier_sku: "GLOBAL-FAP-16X24",    price_cents: 6900, min_lead_days: 10, ship_note: "Ships in ~7 days",  display_order: 20 },
    { slug: "portrait",   name: "The Framed Print",   blurb: "", fulfillment: "print",   deliverable_kind: "portrait",  supplier: "prodigi",    supplier_sku: "GLOBAL-FAP-12X16",    price_cents: 6900, min_lead_days: 10, ship_note: "Ships in ~7 days",  display_order: 30 },
    { slug: "collage",    name: "The Canvas Collage", blurb: "", fulfillment: "print",   deliverable_kind: "collage",   supplier: "prodigi",    supplier_sku: "GLOBAL-CAN-16X20",    price_cents: 5900, min_lead_days: 10, ship_note: "Ships in ~7 days",  display_order: 40 },
    { slug: "mug",        name: "The Mug",            blurb: "", fulfillment: "print",   deliverable_kind: "physical",  supplier: "prodigi",    supplier_sku: "GLOBAL-MUG-11OZ",     price_cents: 2900, min_lead_days: 7,  ship_note: "Ships in ~5 days",  display_order: 50 },
    { slug: "card",       name: "The Card",           blurb: "", fulfillment: "print",   deliverable_kind: "physical",  supplier: "prodigi",    supplier_sku: "GLOBAL-GRE-A5",       price_cents: 1200, min_lead_days: 5,  ship_note: "Ships in ~4 days",  display_order: 60 },
    { slug: "experience", name: "The Experience",     blurb: "", fulfillment: "digital", deliverable_kind: "giftcard",  supplier: "tremendous", supplier_sku: null,                  price_cents: 7500, min_lead_days: 2,  ship_note: "Emailed instantly", display_order: 70 },
    { slug: "giftcard",   name: "The Gift Card",      blurb: "", fulfillment: "digital", deliverable_kind: "giftcard",  supplier: "tremendous", supplier_sku: null,                  price_cents: 5000, min_lead_days: 0,  ship_note: "Emailed instantly", display_order: 80 },
    { slug: "reel",       name: "The Reel",           blurb: "", fulfillment: "digital", deliverable_kind: "reel",      supplier: null,         supplier_sku: null,                  price_cents: 2400, min_lead_days: 0,  ship_note: "Sent as a link",    display_order: 90 },
    { slug: "poem",       name: "The Poem",           blurb: "", fulfillment: "digital", deliverable_kind: "poem",      supplier: null,         supplier_sku: null,                  price_cents: 2400, min_lead_days: 0,  ship_note: "Sent as a link",    display_order: 100 },
  ];
  return Object.fromEntries(rows.map((r) => [r.slug, { ...base, ...r } as Product]));
}
