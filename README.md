# Seetal Pick

A polished, two-person decision app for restaurants, takeaway, things to watch and activities. Each person signs in with a private passphrase, swipes independently, and only sees the shared “yes” list after both have finished the same deck on the same day.

## What is included

- Two-passphrase entry with lightweight Supabase-backed identity
- Touch-first Tinder-style cards with drag, buttons, keyboard controls and undo
- Same-day completion tracking and private-until-complete matches
- Persistent shared decks and a guided add flow
- Live OpenStreetMap place lookups, free TVmaze title lookups, and optional TMDB film/TV lookup
- Responsive layouts for iPhone, iPad, Mac and desktop browsers
- A no-setup local preview mode for trying both sides
- Production builds for both GitHub Pages and OpenAI Sites

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase values, the app intentionally starts in preview mode. Use `together` and `always` to try the two partner views; the preview data is stored only in that browser.

## Connect Supabase

1. Create a Supabase project.
2. Open its SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Change the two sample names and passphrases near the bottom of that file. If you already ran it, update them with:

   ```sql
   update app_users
   set display_name = 'Your name', passphrase_hash = crypt('your-new-passphrase', gen_salt('bf'))
   where id = '11111111-1111-4111-8111-111111111111';

   update app_users
   set display_name = 'Partner name', passphrase_hash = crypt('their-new-passphrase', gen_salt('bf'))
   where id = '22222222-2222-4222-8222-222222222222';
   ```

4. Copy `.env.example` to `.env.local` and add the project URL and anon key from Supabase Project Settings → API.
5. Restart the app. The profile menu will say “Shared live data”.

The security model is deliberately simple, as requested: passphrases are hashed in PostgreSQL and checked by a small database function, while the low-risk shared pick data is available to the public anon key. Do not store sensitive information in this app.

## Lookups

Restaurants, takeaways and activities use OpenStreetMap Nominatim. TV search works with TVmaze and needs no key. For stronger film and TV results, create a TMDB API read token and set `NEXT_PUBLIC_TMDB_READ_TOKEN`.

## GitHub Pages

The workflow at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) deploys every push to `main`.

In GitHub:

1. Set Pages → Source to **GitHub Actions**.
2. Add repository variable `NEXT_PUBLIC_SUPABASE_URL`.
3. Add repository secret `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Optionally add secret `NEXT_PUBLIC_TMDB_READ_TOKEN`.
5. Push to `main`, or run the workflow manually.

The frontend is a static export; all durable data lives in Supabase.

## Useful commands

```bash
npm run dev          # local live preview
npm run build        # Sites-compatible production build
npm run build:github # static output in /out
npm test             # build plus rendered-shell check
npm run lint
```

