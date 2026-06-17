import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Service-role client — BYPASSES RLS. Server-only. NEVER import into client code.
// Used for: anonymous pre-payment draft orders (user_id null), the public /s/[slug]
// share render, and cron/webhook jobs. Keep its surface area small and deliberate.
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
