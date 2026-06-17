// Server-only messaging module (imported by the cron sweep — never by client code).
// Renders a reminder template and sends it via Twilio (SMS) or Resend (email) when those are
// configured; otherwise it cleanly "skips" (no provider keys in dev) and records the attempt in
// message_log either way. No SDKs — both providers are hit over their REST APIs via fetch.

import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/config";
import type { ChannelType } from "@/lib/database.types";

const FROM_EMAIL = process.env.REMINDER_FROM_EMAIL || "Occasion Rescue <reminders@occasionrescue.app>";

export function renderTemplate(
  templateKey: string,
  payload: Record<string, unknown>,
): { subject: string; body: string } {
  const name = (payload?.recipient_name as string) || "someone you love";
  const days = Number(payload?.lead_days ?? 0);
  const when = days >= 14 ? "in about two weeks" : days >= 3 ? "in a few days" : "very soon";

  const subject = `${name}'s anniversary is coming up`;
  const body =
    `Heads up — ${name}'s anniversary is ${when}. ` +
    `Want to rescue it again in three minutes? Open Occasion Rescue and we'll have something ready. ` +
    `(You asked us to remind you about this one date. Reply STOP to opt out.)`;
  return { subject, body };
}

export async function sendMessage(input: {
  userId?: string | null;
  channel: ChannelType;
  to: string;
  templateKey: string;
  payload: Record<string, unknown>;
}): Promise<{ status: string; providerId: string | null }> {
  const { subject, body } = renderTemplate(input.templateKey, input.payload);

  let status = "skipped";
  let providerId: string | null = null;
  let error: string | null = null;

  try {
    if (
      input.channel === "sms" &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_MESSAGING_SERVICE_SID
    ) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const form = new URLSearchParams({
        To: input.to,
        MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        Body: body,
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const json = (await res.json()) as { sid?: string; message?: string };
      if (res.ok) { status = "sent"; providerId = json.sid ?? null; }
      else { status = "failed"; error = json.message ?? `twilio ${res.status}`; }
    } else if (input.channel === "email" && process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: input.to, subject, text: body }),
      });
      const json = (await res.json()) as { id?: string; message?: string };
      if (res.ok) { status = "sent"; providerId = json.id ?? null; }
      else { status = "failed"; error = json.message ?? `resend ${res.status}`; }
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  }

  if (isSupabaseConfigured()) {
    const supabase = createServiceClient();
    await supabase.from("message_log").insert({
      user_id: input.userId ?? null,
      channel: input.channel,
      to_address: input.to,
      template_key: input.templateKey,
      body,
      provider_message_id: providerId,
      status,
      error,
    });
  }

  return { status, providerId };
}
