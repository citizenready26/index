# The Index

A static, GitHub Pages-ready service directory powered by Supabase. Providers create an account, submit a service for review, and an admin approves or rejects it. The public directory only ever shows approved listings, and now supports search + category filtering.

## Delete these first (old leftovers, do not upload these files)

Your repo currently has an older, unrelated set of files at the root that predate this structure. **Delete them** before adding the files below, or they'll shadow/confuse the real pages:

- `config.js` (root)
- `app.js`
- `styles.css` (root)
- `supabase-config.js`
- `dashboard.html`
- `provider.html`

Everything this project needs lives in `index.html`, `auth.html`, `apply.html`, `admin.html`, `reset-password.html`, and the `css/`, `js/`, `supabase/` folders — nothing at the root besides those HTML files and this README.

## Set up Supabase

1. Open your Supabase project.
2. **SQL Editor > New query** — paste the entire contents of `supabase/schema.sql` and run it. It's safe to re-run if you need to reset.
3. Sign up on your site through `auth.html` using your own email.
4. Back in **SQL Editor**, run the commented query at the bottom of `schema.sql`, replacing the email, to make yourself an admin:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
5. In **Project Settings > API**, copy your Project URL and **anon/publishable** key into `js/config.js`. Never put the `service_role` key anywhere in this repo.
6. In **Authentication > URL Configuration**, set the Site URL to your GitHub Pages URL (e.g. `https://YOUR-NAME.github.io/index/`), and add both that URL and `http://localhost:5500` under Redirect URLs — this is required for the password-reset email link to work.

## Deploy

Push these files to your repo and enable **Settings > Pages > Deploy from a branch**. No build step needed.

## Files

- `index.html` — public directory with search + category filter
- `auth.html` — sign up, sign in, forgot password
- `apply.html` — provider dashboard: submit a service, see your submissions' status
- `admin.html` — review queue: approve/reject pending services
- `reset-password.html` — reached from the password-reset email
- `js/config.js` — your Supabase URL + anon key (fill this in)
- `js/supabase-client.js` — shared client + auth/nav helpers
- `js/directory.js`, `js/auth.js`, `js/apply.js`, `js/admin.js` — per-page logic
- `css/styles.css` — shared styling
- `supabase/schema.sql` — tables, triggers, and RLS policies

## First test

1. Sign up as a provider on `auth.html`, then submit a service on `apply.html`. It should show as **pending**.
2. Sign in as your admin account, open `admin.html`, and approve it.
3. It should immediately appear on `index.html` for everyone, including signed-out visitors.
4. Try the search box and category dropdown on the homepage.

## Why it was probably broken

Two common causes if listings weren't showing up before:
- `js/config.js` had a placeholder (or missing) anon key, so every Supabase call failed silently.
- The RLS policies didn't match what the JS was querying (e.g. a policy checking a column name the app didn't use), so `select` returned nothing even for approved rows.

This rebuild's `schema.sql` and `js/*.js` are written to match column-for-column, so if it still doesn't work after setup, check the browser console on the page in question — every fetch here surfaces the real Supabase error message instead of failing silently.
