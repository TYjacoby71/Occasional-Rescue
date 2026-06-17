// Small shared helpers — pricing, slugs, and a guard for whether Supabase is wired up.

// Bundle pricing (canonical): 1 gift $24, 2 gifts $34, 3 gifts $42. Mirrors the prototype.
export const priceFor = (n: number): number => (n >= 3 ? 42 : n === 2 ? 34 : 24);

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// Server-only: is Stripe wired up for real charges?
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Client-safe: when true, paywalls render as a clickable "continue" link instead of
// a real charge. True in development, or whenever Stripe's publishable key is absent.
export function isPaywallBypass(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  );
}

// Public share slug: random + unguessable (the prototype's name-derived slug is a privacy bug).
export function makeShareSlug(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}
