# Occasional Rescue

Occasional Rescue is a reminder and gifting assistant for people who need help remembering important occasions like anniversaries, birthdays, Mother’s Day, Father’s Day, and other special dates.

## Purpose

The app helps users avoid missed celebrations by:
- tracking important occasions for friends, family, and partners
- sending reminders before each event
- suggesting thoughtful gifts and quick rescue options
- storing recipient preferences, notes, and gift ideas

## Key Features

- Occasion management: add, edit, and remove anniversaries, birthdays, holidays, and custom events
- Recipient profiles: save names, relationships, gift preferences, and special notes
- Reminder scheduling: configurable alerts before an occasion arrives
- Gift suggestions: curated ideas based on occasion type and recipient relationship
- Last-minute rescue guidance: same-day delivery, digital gifts, and simple plans

## Project Structure

Next.js (App Router) + Supabase. See `docs/MVP-PLAN.md` for the phased build plan and
`occasionrescuemvpspec.md` for the full spec.

```
app/            Next.js App Router (dashboard now; intake/share/api in later phases)
components/     UI ported from the prototype
lib/            theme tokens, Supabase clients (anon/server/service), date-rule engine, types
db/migrations/  SQL schema (§3 + plan deltas) with RLS
db/seed.sql     occasion_config seed (anniversary active for MVP)
docs/           MVP plan
```

## Getting Started

1. Clone and install:
   ```bash
   git clone https://github.com/TYjacoby71/Occasional-Rescue.git
   cd Occasional-Rescue
   npm install
   ```
2. Copy env and fill in (Supabase first): `cp .env.example .env.local`
3. Apply the data layer to your Supabase project:
   - Run `db/migrations/0001_init.sql` then `db/seed.sql` in the Supabase SQL editor.
   - Regenerate types: `npx supabase gen types typescript --project-id <id> --schema public > lib/database.types.ts`
4. Run the app: `npm run dev`

## Build Status

- **Phase 0 — Infra:** Next.js skeleton, Supabase clients, env scaffold. ✅
- **Phase 1 — Data layer:** schema + RLS + seed + typed client stub. ✅
- **Phase 2+:** lead intake, generation, payments, share microsite, lifecycle. See the plan.

## Goals

- Help forgetful users stay on top of special dates
- Reduce last-minute gift panic with smart recommendations
- Make event planning fast, personal, and reliable

## Next Steps

- Scaffold a React frontend and simple backend API
- Define a data model for occasions, recipients, and reminders
- Add user authentication and notification support
- Build a “rescue mode” for urgent last-minute gifts
