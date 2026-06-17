"use server";

import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured, isStripeConfigured } from "@/lib/config";
import { logEvent } from "@/lib/modules/intake";

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
    metadata: { order_id: input.orderId },
  });

  return { url: session.url! };
}

// Dev-bypass persistence: mark the order paid without a real charge so the demo flow completes.
export async function markOrderPaidDev(input: { orderId: string; amountCents: number }): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();
    await supabase
      .from("orders" as never)
      .update({
        status: "paid",
        amount_cents: input.amountCents,
        paid_at: new Date().toISOString(),
      } as never)
      .eq("id", input.orderId);
    await supabase.from("payments" as never).insert({
      order_id: input.orderId,
      type: "order",
      amount_cents: input.amountCents,
      status: "dev_bypass",
    } as never);
  }
  await logEvent({ name: "paid", orderId: input.orderId, props: { mode: "dev_bypass" } });
}
