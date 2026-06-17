import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/config";
import { sendMessage } from "@/lib/modules/messaging";
import { logEvent } from "@/lib/modules/intake";

export const runtime = "nodejs";

// Daily reminder sweep. CRON_SECRET-guarded (Bearer header or ?secret=). Picks due, pending
// scheduled_messages, resolves each owner's contact from profiles, sends via the messaging
// module, and flips the row to sent/failed. Drains "skipped" rows (no provider configured) to
// sent so the queue doesn't reprocess forever — message_log still records the true outcome.
export async function GET(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") || url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ ok: true, processed: 0, note: "supabase not configured" });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("scheduled_messages")
    .select("id,user_id,channel,template_key,payload")
    .eq("status", "pending")
    .lte("send_at", now)
    .limit(100);
  if (error) return new Response("query failed", { status: 500 });

  let processed = 0;
  let failed = 0;

  for (const m of due ?? []) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("email,phone")
      .eq("id", m.user_id)
      .maybeSingle();
    const to = m.channel === "sms" ? prof?.phone : prof?.email;

    if (!to) {
      await supabase.from("scheduled_messages").update({ status: "failed", sent_at: now }).eq("id", m.id);
      failed++;
      continue;
    }

    const { status, providerId } = await sendMessage({
      userId: m.user_id,
      channel: m.channel,
      to,
      templateKey: m.template_key,
      payload: (m.payload ?? {}) as Record<string, unknown>,
    });

    const newStatus = status === "failed" ? "failed" : "sent";
    await supabase
      .from("scheduled_messages")
      .update({ status: newStatus, sent_at: new Date().toISOString(), provider_message_id: providerId })
      .eq("id", m.id);

    if (newStatus === "failed") failed++;
    else {
      processed++;
      await logEvent({ name: "reminder_sent", props: { channel: m.channel, template: m.template_key, delivery: status } });
    }
  }

  return Response.json({ ok: true, processed, failed });
}
