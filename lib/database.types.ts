// Hand-authored stand-in for `supabase gen types typescript`.
// Phase 1 "done" includes wiring a live Supabase project and regenerating this file:
//   npx supabase gen types typescript --project-id <id> --schema public > lib/database.types.ts
// Until then this keeps the typed clients honest for the tables we touch early.

export type OccasionType =
  | "anniversary" | "valentines" | "mothers_day" | "fathers_day" | "birthday" | "other";
export type RelationshipType =
  | "spouse" | "partner" | "mother" | "father" | "child" | "friend" | "other";
export type RelationshipStatus = "dating" | "engaged" | "married" | "partnered" | "other";
export type GiftTarget = "spouse" | "parent" | "other";
export type OrderStatus = "draft" | "generating" | "preview" | "paid" | "delivered" | "failed";
export type ToneType = "heartfelt" | "funny" | "romantic";
export type DeliverableKind =
  | "microsite" | "reel" | "poem" | "photobook" | "collage" | "song" | "portrait";
export type AssetType = "photo" | "audio" | "video";
export type ChannelType = "sms" | "email";
export type SchedStatus = "pending" | "sent" | "cancelled" | "failed";
export type PaymentType = "order" | "rush" | "reminder_upsell" | "photobook";

export interface OccasionConfigRow {
  type: OccasionType;
  label: string;
  route_slug: string;
  date_rule: string;
  default_lead_days: number[];
  display_order: number;
  needs_gift_target: boolean;
  active: boolean;
}

// Minimal table map. Expand / regenerate as modules come online (Phase 2+).
type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      occasion_config: TableShape<OccasionConfigRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      occasion_type: OccasionType;
      relationship_type: RelationshipType;
      relationship_status: RelationshipStatus;
      gift_target: GiftTarget;
      order_status: OrderStatus;
      tone_type: ToneType;
      deliverable_kind: DeliverableKind;
      asset_type: AssetType;
      channel_type: ChannelType;
      sched_status: SchedStatus;
      payment_type: PaymentType;
    };
    CompositeTypes: Record<string, never>;
  };
}
