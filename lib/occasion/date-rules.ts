// Date-rule engine for occasion_config.date_rule.
// Formats:
//   'user'                       -> user-supplied event_date; next occurrence is the next anniversary of MM-DD
//   'fixed:MM-DD'                -> same calendar day every year (e.g. Valentine's 02-14)
//   'nth_weekday:month,nth,weekday' -> month 1-12, nth 1-5, weekday 0=Sunday (e.g. Mother's '5,2,0')
//
// All math is done in UTC date space (no time-of-day) to keep "the date" stable across timezones.

export type DateRule =
  | { kind: "user" }
  | { kind: "fixed"; month: number; day: number }
  | { kind: "nth_weekday"; month: number; nth: number; weekday: number };

export function parseDateRule(rule: string): DateRule {
  if (rule === "user") return { kind: "user" };

  if (rule.startsWith("fixed:")) {
    const [month, day] = rule.slice("fixed:".length).split("-").map(Number);
    return { kind: "fixed", month, day };
  }

  if (rule.startsWith("nth_weekday:")) {
    const [month, nth, weekday] = rule.slice("nth_weekday:".length).split(",").map(Number);
    return { kind: "nth_weekday", month, nth, weekday };
  }

  throw new Error(`Unrecognized date_rule: ${rule}`);
}

// The nth (1-5) `weekday` of a given month/year. nth=5 clamps to the last matching weekday.
export function nthWeekdayOf(year: number, month: number, nth: number, weekday: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  let day = 1 + offset + (nth - 1) * 7;
  // Clamp to the last valid weekday of the month if nth overshoots.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  while (day > daysInMonth) day -= 7;
  return new Date(Date.UTC(year, month - 1, day));
}

// Resolve the next occurrence (today or future) for a rule.
// `eventDate` (the user's original date) is required for the 'user' rule.
export function nextOccurrence(rule: DateRule, from: Date = new Date(), eventDate?: Date): Date {
  const today = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const year = today.getUTCFullYear();

  const candidateForYear = (y: number): Date => {
    switch (rule.kind) {
      case "fixed":
        return new Date(Date.UTC(y, rule.month - 1, rule.day));
      case "nth_weekday":
        return nthWeekdayOf(y, rule.month, rule.nth, rule.weekday);
      case "user": {
        if (!eventDate) throw new Error("'user' rule requires an eventDate");
        return new Date(Date.UTC(y, eventDate.getUTCMonth(), eventDate.getUTCDate()));
      }
    }
  };

  const thisYear = candidateForYear(year);
  return thisYear >= today ? thisYear : candidateForYear(year + 1);
}
