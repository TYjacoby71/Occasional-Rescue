// Static mirror of the occasion_config seed, used to render the carousel in Phase 0
// before the live Supabase read lands (Phase 2: SELECT * FROM occasion_config WHERE active ORDER BY display_order).
import type { OccasionType } from "@/lib/database.types";

export type OccasionTile = {
  key: OccasionType;
  label: string;
  date: string;        // display string for the tile
  dateRule: string;    // occasion_config.date_rule — drives the intake date step + neck-down
  active: boolean;
  giftTarget?: boolean;
};

export const OCCASIONS: OccasionTile[] = [
  { key: "anniversary", label: "Anniversary", date: "Soonest", dateRule: "user", active: true },
  { key: "valentines", label: "Valentine's Day", date: "Feb 14", dateRule: "fixed:02-14", active: false },
  { key: "mothers_day", label: "Mother's Day", date: "May 10", dateRule: "nth_weekday:5,2,0", active: false, giftTarget: true },
  { key: "fathers_day", label: "Father's Day", date: "Jun 21", dateRule: "nth_weekday:6,3,0", active: false, giftTarget: true },
  { key: "birthday", label: "Birthday", date: "Set a date", dateRule: "user", active: false },
];

export const findOccasion = (key: string): OccasionTile | undefined =>
  OCCASIONS.find((o) => o.key === key);
