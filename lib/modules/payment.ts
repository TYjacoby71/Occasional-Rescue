"use server";

import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured, isStripeConfigured } from "@/lib/config";
import { logEvent } from "@/lib/modules/intake";
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

// Print-on-demand checkout: a real, shippable keepsake. Collects a shipping address and charges
// the item's standalone price. The webhook (purchase=print) records the order + address for
// fulfillment. Falls back to { bypass: true } when Stripe isn't configured (dev).
export async function startPrintCheckout(input: {
  orderId: string;
  kind: DeliverableKind;
  label: string;
  priceCents: number;
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
          unit_amount: input.priceCents,
          product_data: { name: input.label },
        },
      },
    ],
    shipping_address_collection: { allowed_countries: ["US", "CA"] },
    phone_number_collection: { enabled: true },
    customer_creation: "always",
    success_url: `${base}/?print=1&order=${input.orderId}`,
    cancel_url: `${base}/?canceled=1`,
    metadata: { order_id: input.orderId, purchase: "print", kind: input.kind },
  });

  return { url: session.url! };
}

// payment_type only has a dedicated 'photobook' bucket; other print items fall under 'order'.
const PAYMENT_TYPE: Partial<Record<DeliverableKind, PaymentType>> = { photobook: "photobook" };

// Dev-bypass persistence for a print order: record the keepsake (no real charge, no address)
// so the demo flow completes end-to-end without Stripe.
export async function recordPrintOrderDev(input: {
  orderId: string;
  kind: DeliverableKind;
  priceCents: number;
}): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();
    await supabase.from("deliverables").insert({
      order_id: input.orderId,
      kind: input.kind,
      status: "paid",
      payload: { fulfillment: "print", fulfillment_status: "ordered", mode: "dev_bypass" },
    });
    await supabase.from("payments").insert({
      order_id: input.orderId,
      type: PAYMENT_TYPE[input.kind] ?? "order",
      amount_cents: input.priceCents,
      status: "dev_bypass",
    });
  }
  await logEvent({ name: "print_ordered", orderId: input.orderId, props: { kind: input.kind, mode: "dev_bypass" } });
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
