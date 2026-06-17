// Generated from the live Supabase project (occasional-rescue) via:
//   npx supabase gen types typescript --project-id <id> --schema public
// Convenience enum/row aliases for app code are re-exported at the bottom of this file.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          order_id: string
          position: number
          source: string
          storage_path: string
          type: Database["public"]["Enums"]["asset_type"]
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          order_id: string
          position?: number
          source?: string
          storage_path: string
          type?: Database["public"]["Enums"]["asset_type"]
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          order_id?: string
          position?: number
          source?: string
          storage_path?: string
          type?: Database["public"]["Enums"]["asset_type"]
        }
        Relationships: [
          {
            foreignKeyName: "assets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["deliverable_kind"]
          og_image_path: string | null
          order_id: string
          payload: Json
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["deliverable_kind"]
          og_image_path?: string | null
          order_id: string
          payload?: Json
          status?: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["deliverable_kind"]
          og_image_path?: string | null
          order_id?: string
          payload?: Json
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          name: string
          order_id: string | null
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_id?: string | null
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_id?: string | null
          props?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_log: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string
          error: string | null
          id: string
          provider_message_id: string | null
          status: string | null
          template_key: string | null
          to_address: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          status?: string | null
          template_key?: string | null
          to_address: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          error?: string | null
          id?: string
          provider_message_id?: string | null
          status?: string | null
          template_key?: string | null
          to_address?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      occasion_config: {
        Row: {
          active: boolean
          date_rule: string
          default_lead_days: number[]
          display_order: number
          label: string
          needs_gift_target: boolean
          route_slug: string
          type: Database["public"]["Enums"]["occasion_type"]
        }
        Insert: {
          active?: boolean
          date_rule: string
          default_lead_days?: number[]
          display_order?: number
          label: string
          needs_gift_target?: boolean
          route_slug: string
          type: Database["public"]["Enums"]["occasion_type"]
        }
        Update: {
          active?: boolean
          date_rule?: string
          default_lead_days?: number[]
          display_order?: number
          label?: string
          needs_gift_target?: boolean
          route_slug?: string
          type?: Database["public"]["Enums"]["occasion_type"]
        }
        Relationships: []
      }
      occasions: {
        Row: {
          created_at: string
          event_date: string | null
          id: string
          next_occurrence: string | null
          recipient_id: string
          recurring: boolean
          reminder_opt_in: boolean
          type: Database["public"]["Enums"]["occasion_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          id?: string
          next_occurrence?: string | null
          recipient_id: string
          recurring?: boolean
          reminder_opt_in?: boolean
          type: Database["public"]["Enums"]["occasion_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          id?: string
          next_occurrence?: string | null
          recipient_id?: string
          recurring?: boolean
          reminder_opt_in?: boolean
          type?: Database["public"]["Enums"]["occasion_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occasions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occasions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string
          delivered_at: string | null
          gift_target: Database["public"]["Enums"]["gift_target"] | null
          id: string
          intake: Json
          occasion_id: string | null
          occasion_type: Database["public"]["Enums"]["occasion_type"]
          paid_at: string | null
          recipient_id: string | null
          rush: boolean
          share_slug: string | null
          share_token: string | null
          status: Database["public"]["Enums"]["order_status"]
          tone: Database["public"]["Enums"]["tone_type"]
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          gift_target?: Database["public"]["Enums"]["gift_target"] | null
          id?: string
          intake?: Json
          occasion_id?: string | null
          occasion_type: Database["public"]["Enums"]["occasion_type"]
          paid_at?: string | null
          recipient_id?: string | null
          rush?: boolean
          share_slug?: string | null
          share_token?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tone?: Database["public"]["Enums"]["tone_type"]
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          gift_target?: Database["public"]["Enums"]["gift_target"] | null
          id?: string
          intake?: Json
          occasion_id?: string | null
          occasion_type?: Database["public"]["Enums"]["occasion_type"]
          paid_at?: string | null
          recipient_id?: string | null
          rush?: boolean
          share_slug?: string | null
          share_token?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tone?: Database["public"]["Enums"]["tone_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_occasion_id_fkey"
            columns: ["occasion_id"]
            isOneToOne: false
            referencedRelation: "occasions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          order_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_payment_method_id: string | null
          type: Database["public"]["Enums"]["payment_type"]
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          order_id?: string | null
          status: string
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          type?: Database["public"]["Enums"]["payment_type"]
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          order_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_method_id?: string | null
          type?: Database["public"]["Enums"]["payment_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          blurb: string
          created_at: string
          deliverable_kind: Database["public"]["Enums"]["deliverable_kind"]
          display_order: number
          fulfillment: string
          id: string
          min_lead_days: number
          name: string
          price_cents: number
          ship_note: string | null
          slug: string
          supplier: string | null
          supplier_sku: string | null
        }
        Insert: {
          active?: boolean
          blurb?: string
          created_at?: string
          deliverable_kind?: Database["public"]["Enums"]["deliverable_kind"]
          display_order?: number
          fulfillment: string
          id?: string
          min_lead_days?: number
          name: string
          price_cents: number
          ship_note?: string | null
          slug: string
          supplier?: string | null
          supplier_sku?: string | null
        }
        Update: {
          active?: boolean
          blurb?: string
          created_at?: string
          deliverable_kind?: Database["public"]["Enums"]["deliverable_kind"]
          display_order?: number
          fulfillment?: string
          id?: string
          min_lead_days?: number
          name?: string
          price_cents?: number
          ship_note?: string | null
          slug?: string
          supplier?: string | null
          supplier_sku?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_pm_id: string | null
          email: string | null
          email_opt_in: boolean
          email_opt_in_at: string | null
          full_name: string | null
          id: string
          lead_source: string | null
          offsession_consent: boolean
          offsession_consent_at: string | null
          phone: string | null
          pm_brand: string | null
          pm_last4: string | null
          relationship_status:
            | Database["public"]["Enums"]["relationship_status"]
            | null
          sms_opt_in: boolean
          sms_opt_in_at: string | null
          status: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_pm_id?: string | null
          email?: string | null
          email_opt_in?: boolean
          email_opt_in_at?: string | null
          full_name?: string | null
          id: string
          lead_source?: string | null
          offsession_consent?: boolean
          offsession_consent_at?: string | null
          phone?: string | null
          pm_brand?: string | null
          pm_last4?: string | null
          relationship_status?:
            | Database["public"]["Enums"]["relationship_status"]
            | null
          sms_opt_in?: boolean
          sms_opt_in_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_pm_id?: string | null
          email?: string | null
          email_opt_in?: boolean
          email_opt_in_at?: string | null
          full_name?: string | null
          id?: string
          lead_source?: string | null
          offsession_consent?: boolean
          offsession_consent_at?: string | null
          phone?: string | null
          pm_brand?: string | null
          pm_last4?: string | null
          relationship_status?:
            | Database["public"]["Enums"]["relationship_status"]
            | null
          sms_opt_in?: boolean
          sms_opt_in_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recipients: {
        Row: {
          birthday: string | null
          created_at: string
          id: string
          name: string
          nickname: string | null
          relationship: Database["public"]["Enums"]["relationship_type"]
          user_id: string
        }
        Insert: {
          birthday?: string | null
          created_at?: string
          id?: string
          name: string
          nickname?: string | null
          relationship?: Database["public"]["Enums"]["relationship_type"]
          user_id: string
        }
        Update: {
          birthday?: string | null
          created_at?: string
          id?: string
          name?: string
          nickname?: string | null
          relationship?: Database["public"]["Enums"]["relationship_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          created_at: string
          id: string
          occasion_id: string | null
          payload: Json
          provider_message_id: string | null
          recipient_id: string | null
          send_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["sched_status"]
          template_key: string
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          occasion_id?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient_id?: string | null
          send_at: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["sched_status"]
          template_key: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          id?: string
          occasion_id?: string | null
          payload?: Json
          provider_message_id?: string | null
          recipient_id?: string | null
          send_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["sched_status"]
          template_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_occasion_id_fkey"
            columns: ["occasion_id"]
            isOneToOne: false
            referencedRelation: "occasions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          payload: Json | null
          processed: boolean
          source: string
          type: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          payload?: Json | null
          processed?: boolean
          source: string
          type?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          payload?: Json | null
          processed?: boolean
          source?: string
          type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      asset_type: "photo" | "audio" | "video"
      channel_type: "sms" | "email"
      deliverable_kind:
        | "microsite"
        | "reel"
        | "poem"
        | "photobook"
        | "collage"
        | "song"
        | "portrait"
        | "physical"
        | "giftcard"
      gift_target: "spouse" | "parent" | "other"
      occasion_type:
        | "anniversary"
        | "valentines"
        | "mothers_day"
        | "fathers_day"
        | "birthday"
        | "other"
      order_status:
        | "draft"
        | "generating"
        | "preview"
        | "paid"
        | "delivered"
        | "failed"
      payment_type: "order" | "rush" | "reminder_upsell" | "photobook"
      relationship_status:
        | "dating"
        | "engaged"
        | "married"
        | "partnered"
        | "other"
      relationship_type:
        | "spouse"
        | "partner"
        | "mother"
        | "father"
        | "child"
        | "friend"
        | "other"
      sched_status: "pending" | "sent" | "cancelled" | "failed"
      tone_type: "heartfelt" | "funny" | "romantic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_type: ["photo", "audio", "video"],
      channel_type: ["sms", "email"],
      deliverable_kind: [
        "microsite",
        "reel",
        "poem",
        "photobook",
        "collage",
        "song",
        "portrait",
        "physical",
        "giftcard",
      ],
      gift_target: ["spouse", "parent", "other"],
      occasion_type: [
        "anniversary",
        "valentines",
        "mothers_day",
        "fathers_day",
        "birthday",
        "other",
      ],
      order_status: [
        "draft",
        "generating",
        "preview",
        "paid",
        "delivered",
        "failed",
      ],
      payment_type: ["order", "rush", "reminder_upsell", "photobook"],
      relationship_status: [
        "dating",
        "engaged",
        "married",
        "partnered",
        "other",
      ],
      relationship_type: [
        "spouse",
        "partner",
        "mother",
        "father",
        "child",
        "friend",
        "other",
      ],
      sched_status: ["pending", "sent", "cancelled", "failed"],
      tone_type: ["heartfelt", "funny", "romantic"],
    },
  },
} as const

// ── Convenience aliases (hand-maintained) ───────────────────────────────────
// App code imports these short names; they map onto the generated enums/rows above.
export type OccasionType = Database["public"]["Enums"]["occasion_type"]
export type RelationshipType = Database["public"]["Enums"]["relationship_type"]
export type RelationshipStatus = Database["public"]["Enums"]["relationship_status"]
export type GiftTarget = Database["public"]["Enums"]["gift_target"]
export type OrderStatus = Database["public"]["Enums"]["order_status"]
export type ToneType = Database["public"]["Enums"]["tone_type"]
export type DeliverableKind = Database["public"]["Enums"]["deliverable_kind"]
export type AssetType = Database["public"]["Enums"]["asset_type"]
export type ChannelType = Database["public"]["Enums"]["channel_type"]
export type SchedStatus = Database["public"]["Enums"]["sched_status"]
export type PaymentType = Database["public"]["Enums"]["payment_type"]
export type OccasionConfigRow = Database["public"]["Tables"]["occasion_config"]["Row"]
export type ProductRow = Database["public"]["Tables"]["products"]["Row"]
