-- Run once in Supabase SQL Editor. It safely creates a profile only for
-- the authenticated caller, and never changes an existing role or profile.
create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;

  insert into public.profiles (id)
  values (auth.uid())
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_my_profile() from public;
grant execute on function public.ensure_my_profile() to authenticated;

-- Also create profiles automatically for all future Auth sign-ups.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();
