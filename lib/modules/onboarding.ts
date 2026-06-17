"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/config";
import { logEvent } from "@/lib/modules/intake";
import { parseDateRule, nextOccurrence } from "@/lib/occasion/date-rules";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OccasionType, ChannelType } from "@/lib/database.types";

// Lead capture + reminder setup. The schema requires a profile (FK -> auth.users) before we can
// own an occasion or schedule a message, so opting into reminders creates (or reuses) an auth
// user, writes the profile + consent, claims the anonymous order, and lays down the
// scheduled_messages the cron sweep later sends. Full login UI is a later phase; this exercises
// the whole reminder data model with just an email or phone.

type DB = SupabaseClient<Database>;

async function findOrCreateUser(supabase: DB, email?: string, phone?: string): Promise<string | null> {
  const created = await supabase.auth.admin.createUser({
    email: email || undefined,
    phone: phone || undefined,
    email_confirm: true,
    phone_confirm: true,
  });
  if (!created.error && created.data.user) return created.data.user.id;

  // Already registered -> find the existing user (small user base; a single page scan is fine).
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const match = list?.users?.find(
    (u) => (email && u.email === email) || (phone && u.phone === phone),
  );
  return match?.id ?? null;
}

export async function setupReminder(input: {
  orderId: string;
  occasionType: OccasionType;
  recipientName: string;
  email?: string;
  phone?: string;
  eventDate?: string; // yyyy-mm-dd, required for 'user'-rule occasions (e.g. anniversary)
  emailOptIn: boolean;
  smsOptIn: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  if (!email && !phone) return { ok: false, reason: "Add an email or phone number." };

  if (!isSupabaseConfigured()) return { ok: true }; // dev no-op so the UI flow completes

  const supabase = createServiceClient();

  const userId = await findOrCreateUser(supabase, email, phone);
  if (!userId) return { ok: false, reason: "Couldn't save your contact." };

  const now = new Date().toISOString();
  await supabase.from("profiles").upsert(
    {
      id: userId,
      status: "customer",
      email: email ?? null,
      phone: phone ?? null,
      email_opt_in: input.emailOptIn,
      email_opt_in_at: input.emailOptIn ? now : null,
      sms_opt_in: input.smsOptIn,
      sms_opt_in_at: input.smsOptIn ? now : null,
    },
    { onConflict: "id" },
  );

  // Claim the (previously anonymous) order for this user.
  await supabase.from("orders").update({ user_id: userId }).eq("id", input.orderId);

  // Recipient + occasion.
  const { data: rec } = await supabase
    .from("recipients")
    .insert({ user_id: userId, name: input.recipientName || "Someone special", relationship: "other" })
    .select("id")
    .single();
  const recipientId = rec?.id;
  if (!recipientId) return { ok: false, reason: "recipient" };

  const { data: cfg } = await supabase
    .from("occasion_config")
    .select("date_rule,default_lead_days")
    .eq("type", input.occasionType)
    .maybeSingle();
  const dateRule = cfg?.date_rule ?? "user";
  const leadDays = cfg?.default_lead_days ?? [14, 3];

  let next: Date;
  try {
    const rule = parseDateRule(dateRule);
    const eventDate = input.eventDate ? new Date(`${input.eventDate}T00:00:00Z`) : undefined;
    next = nextOccurrence(rule, new Date(), eventDate);
  } catch {
    return { ok: false, reason: "Add the date so we know when to remind you." };
  }
  const nextDateStr = next.toISOString().slice(0, 10);

  const { data: occ } = await supabase
    .from("occasions")
    .upsert(
      {
        user_id: userId,
        recipient_id: recipientId,
        type: input.occasionType,
        event_date: input.eventDate ?? null,
        recurring: true,
        reminder_opt_in: true,
        next_occurrence: nextDateStr,
      },
      { onConflict: "recipient_id,type" },
    )
    .select("id")
    .single();
  const occasionId = occ?.id;

  // Schedule a message at each lead day before the next occurrence.
  const channel: ChannelType = phone && input.smsOptIn ? "sms" : "email";
  if (occasionId) {
    const rows = leadDays.map((d) => ({
      user_id: userId,
      recipient_id: recipientId,
      occasion_id: occasionId,
      channel,
      template_key: `reminder_${d}d`,
      send_at: new Date(next.getTime() - d * 86_400_000).toISOString(),
      status: "pending" as const,
      payload: { recipient_name: input.recipientName, occasion: input.occasionType, lead_days: d },
    }));
    await supabase
      .from("scheduled_messages")
      .upsert(rows, { onConflict: "occasion_id,template_key,send_at" });
  }

  await logEvent({ name: "onboard_complete", orderId: input.orderId, props: { channel } });
  return { ok: true };
}

// Waitlist capture for an occasion that isn't live yet (the greyed dashboard tiles). No order
// exists at this point, so this is a lighter touch than setupReminder: create/reuse the contact,
// store the opt-ins as a lead, and record interest in the occasion so we can reach out when it
// launches. Degrades to a dev no-op without Supabase.
export async function joinWaitlist(input: {
  occasionType: OccasionType;
  email?: string;
  phone?: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  if (!email && !phone) return { ok: false, reason: "Add an email or phone number." };

  if (!isSupabaseConfigured()) return { ok: true }; // dev no-op so the UI flow completes

  const supabase = createServiceClient();
  const userId = await findOrCreateUser(supabase, email, phone);
  if (!userId) return { ok: false, reason: "Couldn't save your contact." };

  const now = new Date().toISOString();
  await supabase.from("profiles").upsert(
    {
      id: userId,
      status: "lead",
      email: email ?? null,
      phone: phone ?? null,
      email_opt_in: input.emailOptIn,
      email_opt_in_at: input.emailOptIn ? now : null,
      sms_opt_in: input.smsOptIn,
      sms_opt_in_at: input.smsOptIn ? now : null,
    },
    { onConflict: "id" },
  );

  await logEvent({ name: "waitlist_join", props: { occasion: input.occasionType, channel: phone && input.smsOptIn ? "sms" : "email" } });
  return { ok: true };
}
