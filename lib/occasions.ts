// Static mirror of the occasion_config seed, used to render the carousel in Phase 0
// before the live Supabase read lands (Phase 2: SELECT * FROM occasion_config WHERE active ORDER BY display_order).
import type { OccasionType } from "@/lib/database.types";

export type OccasionTile = {
  key: OccasionType;
  label: string;
  date: string;        // display string for the tile
  active: boolean;
  giftTarget?: boolean;
};

export const OCCASIONS: OccasionTile[] = [
  { key: "anniversary", label: "Anniversary", date: "Soonest", active: true },
  { key: "valentines", label: "Valentine's Day", date: "Feb 14", active: false },
  { key: "mothers_day", label: "Mother's Day", date: "May 10", active: false, giftTarget: true },
  { key: "fathers_day", label: "Father's Day", date: "Jun 21", active: false, giftTarget: true },
  { key: "birthday", label: "Birthday", date: "Set a date", active: false },
];
