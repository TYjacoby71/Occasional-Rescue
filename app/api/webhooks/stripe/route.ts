import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { isStripeConfigured, isSupabaseConfigured } from "@/lib/config";
import { getProduct } from "@/lib/modules/catalog";
import { submitToSupplier, type ShippingDetails } from "@/lib/modules/fulfillment";
import type { Database, Json } from "@/lib/database.types";

type DeliverableKind = Database["public"]["Enums"]["deliverable_kind"];
type PaymentType = Database["public"]["Enums"]["payment_type"];

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
      // 'print' (shippable keepsake) and 'commerce' (gift card / experience) are both single-item
      // catalog orders that get handed to a supplier; 'digital' is the bundle paywall.
      const isItemOrder = s.metadata?.purchase === "print" || s.metadata?.purchase === "commerce";
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

        if (isItemOrder) {
          // Resolve the SKU from the catalog (source of truth for kind + supplier), capture the
          // shipping address Stripe collected, and hand the order to the supplier (Prodigi when
          // configured; otherwise recorded for concierge fulfillment).
          const product = s.metadata?.slug ? await getProduct(s.metadata.slug) : null;
          const kind: DeliverableKind = product?.deliverable_kind ?? "physical";
          const shipping = (s.collected_information?.shipping_details ?? null) as ShippingDetails;
          const customerEmail = s.customer_details?.email ?? null;
          const assetUrls = await orderAssetUrls(supabase, orderId);

          const fulfillment = product
            ? await submitToSupplier({ product, orderId, shipping, recipientEmail: customerEmail, assetUrls })
            : { status: "concierge" as const, supplier: null, supplierOrderId: null, detail: "no product" };

          await supabase.from("deliverables").insert({
            order_id: orderId,
            kind,
            status: "paid",
            payload: {
              fulfillment: product?.fulfillment ?? "print",
              product_slug: product?.slug ?? s.metadata?.slug ?? null,
              supplier: fulfillment.supplier,
              fulfillment_status: fulfillment.status,
              supplier_order_id: fulfillment.supplierOrderId,
              fulfillment_detail: fulfillment.detail ?? null,
              shipping,
              customer_email: customerEmail,
            } as Json,
          });
          await supabase.from("payments").insert({
            order_id: orderId,
            type: (kind === "photobook" ? "photobook" : "order") as PaymentType,
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

// Long-lived signed URLs for an order's photos, so a print supplier can fetch the artwork. The
// `assets` bucket is private; 7 days is ample for a POD job to pull files.
async function orderAssetUrls(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
): Promise<string[]> {
  const { data: rows } = await supabase
    .from("assets")
    .select("storage_path")
    .eq("order_id", orderId)
    .order("position");
  const paths = (rows ?? []).map((r) => r.storage_path).filter(Boolean);
  if (!paths.length) return [];
  const { data: signed } = await supabase.storage.from("assets").createSignedUrls(paths, 60 * 60 * 24 * 7);
  return (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
}
