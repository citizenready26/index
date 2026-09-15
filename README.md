# The Index

A static, GitHub Pages-ready service directory powered by Supabase. Providers create an account, submit one or more services for review, and an authorised administrator approves, rejects, or removes them. The public directory never contains sample listings: it reads only approved submissions from Supabase.

## Before publishing

1. Create/open the Supabase project at `https://abqlweiiwhjjpxdlokar.supabase.co`.
2. In **SQL Editor**, run the complete contents of [`supabase/schema.sql`](supabase/schema.sql).
3. Create your administrator account through the website's normal sign-up page (or Supabase Authentication > Users), then run the small **Make yourself an admin** query at the end of `schema.sql`, replacing the email address.
4. In **Authentication > URL Configuration**, set the Site URL to your GitHub Pages URL, for example `https://YOUR-NAME.github.io/the-index/`. Add both that URL and `http://localhost:5500` to Redirect URLs. This is required for password-reset links.
5. Upload this folder to a GitHub repository and enable **Settings > Pages > Deploy from a branch**. No build step or server is needed.

The project URL and publishable key are in [`js/config.js`](js/config.js). Publishable keys are designed for browser use; database access is protected by the SQL Row Level Security policies, not by keeping this key secret. Never add a Supabase `service_role` key to this project.

## Files

- `index.html` — approved public directory
- `auth.html` — sign up, sign in, and forgot-password flow
- `apply.html` — provider profile and service application form
- `admin.html` — protected review dashboard
- `reset-password.html` — password-update page reached from the email link
- `supabase/schema.sql` — tables, triggers, storage bucket, and RLS policies

## First test

1. Sign up as a provider, complete the profile and submit a service.
2. Sign out, sign into the account designated as admin, and open **Admin**.
3. Approve the pending service. It will immediately appear on the home page for everyone.

