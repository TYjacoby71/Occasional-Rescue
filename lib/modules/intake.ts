"use server";

import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/config";
import type { OccasionType, GiftTarget, ToneType } from "@/lib/database.types";

// Anonymous pre-payment flow: draft orders have user_id NULL and are written via the
// service role (RLS can't see NULL-owner rows). When Supabase isn't configured yet, these
// degrade to local no-ops returning synthetic ids so the UI flow still runs in dev.

export async function createDraftOrder(input: {
  occasionType: OccasionType;
  giftTarget?: GiftTarget;
}): Promise<{ orderId: string }> {
  if (!isSupabaseConfigured()) return { orderId: randomUUID() };

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders" as never)
    .insert({
      occasion_type: input.occasionType,
      gift_target: input.giftTarget ?? null,
      status: "draft",
    } as never)
    .select("id")
    .single();

  if (error) throw new Error(`createDraftOrder failed: ${error.message}`);
  const orderId = (data as { id: string }).id;
  await logEvent({ name: "panic_start", orderId, props: { occasion: input.occasionType } });
  return { orderId };
}

export async function saveIntake(input: {
  orderId: string;
  intake: Record<string, unknown>;
  tone: ToneType;
  giftKeys: string[];
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("orders" as never)
    .update({
      intake: { ...input.intake, gifts: input.giftKeys },
      tone: input.tone,
      status: "generating",
    } as never)
    .eq("id", input.orderId);

  if (error) throw new Error(`saveIntake failed: ${error.message}`);
  await logEvent({ name: "intake_complete", orderId: input.orderId });
}

export async function logEvent(input: {
  name: string;
  orderId?: string;
  props?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createServiceClient();
  await supabase.from("events" as never).insert({
    name: input.name,
    order_id: input.orderId ?? null,
    props: input.props ?? {},
  } as never);
}
