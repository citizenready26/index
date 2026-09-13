-- The Index: secure admin recognition and moderation repair
-- Run this once in the Supabase SQL Editor as the project owner.
-- This migration does NOT let users assign themselves an admin role.

begin;

-- This migration intentionally does not modify existing profile roles or role
-- constraints. `public.profiles.role` is already the application’s source of
-- role data; the only privileged value recognized below is the exact value
-- `admin`.

-- Database source of truth for the current authenticated user. This does not
-- expose the profiles table and remains correct even if profiles RLS is strict.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- The only frontend-facing path for a status transition. It authorizes the
-- caller inside the database, validates the target status, and changes only
-- the status field of the nominated provider.
create or replace function public.moderate_provider_listing(
  target_provider_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only an admin can change a listing moderation status';
  end if;

  if next_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Invalid listing moderation status';
  end if;

  update public.providers
  set status = next_status
  where id = target_provider_id;

  if not found then
    raise exception 'Listing not found';
  end if;
end;
$$;

revoke all on function public.moderate_provider_listing(uuid, text) from public;
grant execute on function public.moderate_provider_listing(uuid, text) to authenticated;

-- Keep the existing listing RLS policies. In particular, do not add a broad
-- client UPDATE policy for moderators: the RPC above is the moderation path.
commit;

-- ONE-TIME BOOTSTRAP (run separately, after replacing the email exactly):
-- This is intentionally not callable from the browser and is the only step
-- that grants admin. It also creates the profile if the trigger missed it.
--
-- insert into public.profiles (id, role)
-- select id, 'admin'
-- from auth.users
-- where lower(email) = lower('YOUR-ADMIN-EMAIL@example.com')
-- on conflict (id) do update set role = 'admin';
--
-- Verify the account after bootstrap (while signed in as the same account):
-- select auth.uid(), public.is_admin();
