# The Index — moderation-ready build

Configure only your Supabase project URL and **anon** key in `config.js`. Never place a service-role key in a browser file.

The directory and provider page query only approved listings. Owners see their own pending and rejected listings in the dashboard. The admin page checks `profiles.role = 'admin'`; retain your existing RLS policies because RLS, not browser JavaScript, is the security boundary.
