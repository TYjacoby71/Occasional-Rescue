// Lead-time engine. Turns "when is the event" into "how many days do we have," which drives
// which deliverables are still orderable. The catalog (lib/gifts.ts) necks down as this shrinks:
// 3+ weeks out unlocks the premium print products; the last-minute window is digital-only.
//
// All math is in UTC date space (no time-of-day) so "days away" is stable across timezones.

import { parseDateRule, nextOccurrence, type DateRule } from "@/lib/occasion/date-rules";

// Whole days from today (UTC) until `eventISO` (a YYYY-MM-DD string). Past dates clamp to 0.
export function daysUntil(eventISO: string, from: Date = new Date()): number {
  if (!eventISO) return 0;
  const [y, m, d] = eventISO.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const event = Date.UTC(y, m - 1, d);
  const today = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.max(0, Math.round((event - today) / 86_400_000));
}

// Resolve a YYYY-MM-DD event date for an occasion. Computed-date occasions (Valentine's,
// Mother's/Father's Day) are derived from their date_rule; 'user' occasions (anniversary,
// birthday) return null so the intake asks for the date.
export function computedEventDate(dateRule: string, from: Date = new Date()): string | null {
  let rule: DateRule;
  try {
    rule = parseDateRule(dateRule);
  } catch {
    return null;
  }
  if (rule.kind === "user") return null;
  const d = nextOccurrence(rule, from);
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

// Friendly "N days away" copy for the intake + selection header.
export function leadLabel(days: number): string {
  if (days <= 0) return "It's today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `${days} days away`;
  if (days < 14) return "About a week away";
  if (days < 21) return "About two weeks away";
  if (days < 35) return "Three weeks+ away";
  return "Plenty of time";
}
