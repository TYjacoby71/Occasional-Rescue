import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { isStripeConfigured, isSupabaseConfigured } from "@/lib/config";
import type { Database, Json } from "@/lib/database.types";

type DeliverableKind = Database["public"]["Enums"]["deliverable_kind"];

export const runtime = "nodejs";

// Stripe webhook: marks orders paid on checkout completion. Idempotent via webhook_events
// (unique source+event_id). No-ops cleanly until Stripe + the webhook secret are configured.
export async function POST(req: NextRequest): Promise<Response> {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("stripe not configured", { status: 200 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();

    // Idempotency: unique(source, event_id) — a duplicate insert errors and we stop.
    const { error: dupe } = await supabase.from("webhook_events").insert({
      source: "stripe",
      event_id: event.id,
      type: event.type,
      payload: event as unknown as Json,
    });
    if (dupe) return new Response("duplicate", { status: 200 });

    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.order_id;
      const isPrint = s.metadata?.purchase === "print";
      const intentId = typeof s.payment_intent === "string" ? s.payment_intent : null;
      if (orderId) {
        await supabase
          .from("orders")
          .update({
            status: "paid",
            amount_cents: s.amount_total,
            paid_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (isPrint) {
          // A shippable keepsake: capture the address Stripe collected so we can fulfill it,
          // and record the print deliverable against the order.
          const shipping = (s.collected_information?.shipping_details ?? null) as unknown as Record<string, unknown> | null;
          const kind = (s.metadata?.kind ?? "photobook") as DeliverableKind;
          await supabase.from("deliverables").insert({
            order_id: orderId,
            kind,
            status: "paid",
            payload: {
              fulfillment: "print",
              fulfillment_status: "ordered",
              shipping,
              customer_email: s.customer_details?.email ?? null,
            } as Json,
          });
          await supabase.from("payments").insert({
            order_id: orderId,
            type: kind === "photobook" ? "photobook" : "order",
            amount_cents: s.amount_total ?? 0,
            status: "succeeded",
            stripe_payment_intent_id: intentId,
          });
        } else {
          await supabase.from("payments").insert({
            order_id: orderId,
            type: "order",
            amount_cents: s.amount_total ?? 0,
            status: "succeeded",
            stripe_payment_intent_id: intentId,
          });
        }
      }
    }
  }

  return new Response("ok", { status: 200 });
}
