"use server";

import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured, isStripeConfigured } from "@/lib/config";
import { logEvent } from "@/lib/modules/intake";
import { getProduct } from "@/lib/modules/catalog";
import type { Database } from "@/lib/database.types";

type DeliverableKind = Database["public"]["Enums"]["deliverable_kind"];
type PaymentType = Database["public"]["Enums"]["payment_type"];

// Phase 4 payments. When Stripe is configured, start a Checkout Session that charges the
// bundle price AND saves the card for later off-session reorders (setup_future_usage), which
// also captures the off-session consent the spec requires. When Stripe is NOT configured
// (dev), return { bypass: true } so the paywall becomes a clickable continue link.

export async function startCheckout(input: {
  orderId: string;
  amountCents: number;
  label: string;
}): Promise<{ bypass: true } | { url: string }> {
  if (!isStripeConfigured()) return { bypass: true };

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.amountCents,
          product_data: { name: input.label },
        },
      },
    ],
    // Save the card on file + capture off-session reorder consent.
    payment_intent_data: { setup_future_usage: "off_session" },
    customer_creation: "always",
    success_url: `${base}/?paid=1&order=${input.orderId}`,
    cancel_url: `${base}/?canceled=1`,
    metadata: { order_id: input.orderId, purchase: "digital" },
  });

  return { url: session.url! };
}

// Single-item checkout for a catalog product (a print keepsake OR a commerce voucher). The client
// sends only the product SLUG — price, lead time, and fulfillment class are resolved SERVER-SIDE
// from the `products` table, so a tampered price can't get through. We re-check the lead window
// here too (the neck-down is a UI hint; this is the gate). Print items collect a shipping address;
// commerce items (gift card / experience) are delivered digitally. The webhook (purchase=print|
// commerce) records the order and hands it to the supplier. Falls back to { bypass: true } in dev.
export async function startPrintCheckout(input: {
  orderId: string;
  slug: string;
  daysUntil: number;
}): Promise<{ bypass: true } | { url: string } | { error: string }> {
  const product = await getProduct(input.slug);
  if (!product) return { error: "unknown_product" };
  if (input.daysUntil < product.min_lead_days) return { error: "past_lead_window" };

  if (!isStripeConfigured()) return { bypass: true };

  const isShippable = product.fulfillment === "print";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: product.price_cents, // server price — never the client's
          product_data: { name: `Occasion Rescue — ${product.name}` },
        },
      },
    ],
    ...(isShippable
      ? {
          shipping_address_collection: { allowed_countries: ["US", "CA"] },
          phone_number_collection: { enabled: true },
        }
      : {}),
    customer_creation: "always",
    success_url: `${base}/?print=1&order=${input.orderId}`,
    cancel_url: `${base}/?canceled=1`,
    metadata: {
      order_id: input.orderId,
      purchase: isShippable ? "print" : "commerce",
      slug: product.slug,
    },
  });

  return { url: session.url! };
}

// payment_type only has a dedicated 'photobook' bucket; other items fall under 'order'.
const PAYMENT_TYPE: Partial<Record<DeliverableKind, PaymentType>> = { photobook: "photobook" };

// Dev-bypass persistence for a single-item order: record the keepsake/voucher (no real charge,
// no address) so the demo flow completes end-to-end without Stripe. Price + kind come from the
// product table, not the client.
export async function recordPrintOrderDev(input: { orderId: string; slug: string }): Promise<void> {
  const product = await getProduct(input.slug);
  if (!product) return;
  const kind = product.deliverable_kind;

  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();
    await supabase.from("deliverables").insert({
      order_id: input.orderId,
      kind,
      status: "paid",
      payload: {
        fulfillment: product.fulfillment,
        fulfillment_status: "concierge",
        product_slug: product.slug,
        supplier: product.supplier,
        mode: "dev_bypass",
      },
    });
    await supabase.from("payments").insert({
      order_id: input.orderId,
      type: PAYMENT_TYPE[kind] ?? "order",
      amount_cents: product.price_cents,
      status: "dev_bypass",
    });
  }
  await logEvent({ name: "print_ordered", orderId: input.orderId, props: { slug: product.slug, mode: "dev_bypass" } });
}

// Dev-bypass persistence: mark the order paid without a real charge so the demo flow completes.
export async function markOrderPaidDev(input: { orderId: string; amountCents: number }): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();
    await supabase
      .from("orders")
      .update({
        status: "paid",
        amount_cents: input.amountCents,
        paid_at: new Date().toISOString(),
      })
      .eq("id", input.orderId);
    await supabase.from("payments").insert({
      order_id: input.orderId,
      type: "order",
      amount_cents: input.amountCents,
      status: "dev_bypass",
    });
  }
  await logEvent({ name: "paid", orderId: input.orderId, props: { mode: "dev_bypass" } });
}
