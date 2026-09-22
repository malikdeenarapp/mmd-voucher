# Shared History Backend — Setup Guide

This turns the voucher History into a **shared** list that every computer/phone opening the
site sees (instead of each browser keeping its own separate list in localStorage).

It uses two free services:
- **Supabase** — a free hosted Postgres database (the "small database").
- **Vercel** — already your host; it will also run one tiny serverless function
  (`/api/vouchers.js`, already included in this project) that talks to Supabase.

No server to maintain, no monthly cost at this scale.

## 1. Create a Supabase project

1. Go to https://supabase.com → Sign up (free) → "New project".
2. Pick any name/region, set a database password (save it somewhere safe), wait ~2 minutes
   while it provisions.

## 2. Create the `vouchers` table

1. In your Supabase project, open **SQL Editor** (left sidebar) → "New query".
2. Paste this and click **Run**:

```sql
create extension if not exists pgcrypto;

create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  data jsonb not null
);
```

That's the whole schema — every voucher's fields are stored together as one JSON object per
row, so future field changes never need another migration.

## 3. Get your API keys

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** (looks like `https://xxxxxxxx.supabase.co`).
3. Copy the **`service_role`** secret key (NOT the "anon public" one — the service_role key
   must stay secret and server-side only, which is exactly what our `/api/vouchers.js`
   function does).

## 4. Add the keys to Vercel

1. Open your project on https://vercel.com/dashboard → **Settings → Environment Variables**.
2. Add two variables (for "Production", and "Preview" if you use it too):
   - `SUPABASE_URL` = the Project URL from step 3
   - `SUPABASE_SERVICE_KEY` = the service_role key from step 3
3. Save, then go to **Deployments** and re-deploy (or just push any small change to the
   GitHub repo) so the function picks up the new variables.

## 5. Test it

Open your deployed site, fill a voucher, click **Save to History**. Open the same link on a
different phone/computer — the voucher should now appear there too. History older than 2
days is cleaned up automatically every time the History panel loads.

## Notes

- The app's **Print** and **Download PDF** buttons never need the backend — they work fully
  offline once the site has been opened once (thanks to the PWA service worker). Only
  **Save to History** and the **History panel** need an internet connection and this backend.
- If `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` are not set yet, the History panel will show a
  clear "not configured" message instead of breaking — the rest of the voucher form keeps
  working normally.
- Data lives in your own free Supabase project — you can browse, export or clear it anytime
  from Supabase's **Table Editor**.
