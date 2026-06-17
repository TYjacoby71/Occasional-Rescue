"use server";

import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured, makeShareSlug } from "@/lib/config";
import { signedUrlsForOrder } from "@/lib/modules/assets";
import { logEvent } from "@/lib/modules/intake";

// The public share microsite. publishShare() stamps an order with an unguessable slug + token
// (the token guards the page; the slug is never name-derived), flips it to delivered, and is
// idempotent on re-send. getShare() composes the order's intake + deliverables + signed photos
// into the render payload for /s/[slug].

export type ShareData = {
  name: string;
  pet: string;
  secret: string;
  reason: string;
  tone: string;
  photos: string[];
  kinds: string[];
  story: { headline: string; body: string } | null;
  poem: string[] | null;
};

export async function publishShare(input: { orderId: string }): Promise<{ slug: string; token: string }> {
  const slug = makeShareSlug();
  const token = randomUUID().replace(/-/g, "");

  if (!isSupabaseConfigured() || !input.orderId) return { slug, token };

  const supabase = createServiceClient();

  // Idempotent: reuse the existing slug/token if this order was already published.
  const { data: existing } = await supabase
    .from("orders")
    .select("share_slug,share_token")
    .eq("id", input.orderId)
    .maybeSingle();
  if (existing?.share_slug && existing?.share_token) {
    return { slug: existing.share_slug, token: existing.share_token };
  }

  await supabase
    .from("orders")
    .update({
      share_slug: slug,
      share_token: token,
      status: "delivered",
      delivered_at: new Date().toISOString(),
    })
    .eq("id", input.orderId);

  await logEvent({ name: "shared", orderId: input.orderId });
  return { slug, token };
}

export async function getShare(slug: string, token: string): Promise<ShareData | null> {
  if (!isSupabaseConfigured() || !slug || !token) return null;

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id,intake,tone,share_token")
    .eq("share_slug", slug)
    .maybeSingle();

  // Token guard: a wrong or missing token is indistinguishable from "not found".
  if (!order || !order.share_token || order.share_token !== token) return null;

  const { data: dels } = await supabase
    .from("deliverables")
    .select("kind,payload")
    .eq("order_id", order.id);
  const deliverables = dels ?? [];

  const photos = await signedUrlsForOrder(order.id);
  const intake = (order.intake ?? {}) as Record<string, string>;

  const storyDel = deliverables.find((d) => d.kind !== "poem");
  const poemDel = deliverables.find((d) => d.kind === "poem");
  const storyPayload = (storyDel?.payload ?? {}) as { headline?: string; body?: string };
  const poemPayload = (poemDel?.payload ?? {}) as { poem?: string[] };

  return {
    name: intake.name ?? "",
    pet: intake.pet ?? "",
    secret: intake.secret ?? "",
    reason: intake.reason ?? "",
    tone: order.tone ?? "heartfelt",
    photos,
    kinds: deliverables.map((d) => d.kind),
    story: storyDel ? { headline: storyPayload.headline ?? "", body: storyPayload.body ?? "" } : null,
    poem: poemDel ? poemPayload.poem ?? null : null,
  };
}
