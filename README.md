# The Index — moderation-ready build

Configure only your Supabase project URL and **anon** key in `config.js`. Never place a service-role key in a browser file.

The directory and provider page query only approved listings. Owners see their own pending and rejected listings in the dashboard. The admin page checks `profiles.role = 'admin'`; retain your existing RLS policies because RLS, not browser JavaScript, is the security boundary.

## Admin moderation repair

Run `supabase-admin-moderation-fix.sql` in the Supabase SQL Editor, then run its clearly marked one-time bootstrap query with the email address of the intended administrator. The migration makes `is_admin()` the database source of truth and sends approve/reject actions through the restricted `moderate_provider_listing` RPC. It deliberately does not add a broad client update policy or a self-service role-change path.
