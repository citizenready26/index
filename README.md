# The Index — Supabase-connected prototype

This build keeps the polished directory UI and adds a real Supabase connection.

## Connected now
- Supabase client using the public publishable key
- Email/password sign-in and account creation
- Profile upsert for signed-in users
- Real provider records are loaded from the `providers` table when RLS allows it
- Provider links use `provider.html?id=...`
- Favourites can be saved for authenticated real providers
- Existing demo listings remain available as fallback/sample content

## Important
The frontend uses only the Supabase **publishable** key. Never put the `secret` or `service_role` key in these files.

GitHub Pages is still public. Supabase authentication does not password-protect the GitHub Pages URL itself. For private development, put an access layer such as Cloudflare Access in front of the site.

## Existing backend tables expected
`profiles`, `providers`, `provider_photos`, `reviews`, `favourites`.

The current prototype intentionally does not upload photos yet; secure Storage bucket setup is the next backend step.
