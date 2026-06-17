"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/config";
import { OCCASIONS, type OccasionTile } from "@/lib/occasions";
import { parseDateRule, nextOccurrence } from "@/lib/occasion/date-rules";
import type { OccasionType } from "@/lib/database.types";

// Phase 2: the dashboard carousel is driven by occasion_config (the source of truth), not the
// static mirror. The service role reads ALL rows (active + inactive) so "coming soon" tiles
// still render; the static OCCASIONS list is the fallback when Supabase isn't configured.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Human display string for a tile, derived from the occasion's date_rule.
function dateLabel(type: OccasionType, rule: string): string {
  if (type === "anniversary") return "Soonest";
  try {
    const r = parseDateRule(rule);
    if (r.kind === "user") return "Set a date";
    const d = nextOccurrence(r);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  } catch {
    return "Set a date";
  }
}

export async function listOccasions(): Promise<OccasionTile[]> {
  if (!isSupabaseConfigured()) return OCCASIONS;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("occasion_config")
    .select("type,label,date_rule,display_order,needs_gift_target,active")
    .order("display_order");

  if (error || !data || data.length === 0) return OCCASIONS;

  return data.map((row) => ({
    key: row.type,
    label: row.label,
    date: dateLabel(row.type, row.date_rule),
    active: row.active,
    giftTarget: row.needs_gift_target || undefined,
  }));
}
