-- The Index: run this file once in Supabase Dashboard > SQL Editor.
-- It is safe to run on a new project. It does not use a service-role key in the website.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'provider' check (role in ('provider', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade an older profiles table from an earlier version of the project.
-- CREATE TABLE IF NOT EXISTS does not add missing columns to a table that already exists.
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists role text not null default 'provider';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
-- Older versions used values such as "user". Preserve real admins; convert every
-- other legacy value to the safe default before enforcing the new rule.
update public.profiles
set role = case when lower(trim(coalesce(role, ''))) = 'admin' then 'admin' else 'provider' end
where role is distinct from 'provider' and role is distinct from 'admin';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('provider', 'admin'));

create table if not exists public.service_applications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  service_name text not null check (char_length(service_name) between 2 and 120),
  category text not null check (char_length(category) between 2 and 80),
  city text not null check (char_length(city) between 2 and 120),
  description text not null check (char_length(description) between 20 and 1500),
  website text check (website is null or website ~* '^https?://'),
  image_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists service_applications_public_index on public.service_applications(status, approved_at desc);
create index if not exists service_applications_provider_index on public.service_applications(provider_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists applications_updated_at on public.service_applications;
create trigger applications_updated_at before update on public.service_applications for each row execute function public.set_updated_at();

-- Every Auth signup receives a corresponding provider profile automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Security-definer helper avoids an RLS recursion issue while checking admin access.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.service_applications enable row level security;

drop policy if exists "profiles: owner reads" on public.profiles;
create policy "profiles: owner reads" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles: owner updates safe fields" on public.profiles;
create policy "profiles: owner updates safe fields" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'provider');
drop policy if exists "profiles: admin reads all" on public.profiles;
create policy "profiles: admin reads all" on public.profiles for select to authenticated using (public.is_admin());
drop policy if exists "profiles: admin manages" on public.profiles;
create policy "profiles: admin manages" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- The public sees only approved entries. Providers can see only their own submissions.
drop policy if exists "services: public reads approved" on public.service_applications;
create policy "services: public reads approved" on public.service_applications for select to anon, authenticated using (status = 'approved');
drop policy if exists "services: provider reads own" on public.service_applications;
create policy "services: provider reads own" on public.service_applications for select to authenticated using (provider_id = auth.uid());
drop policy if exists "services: provider submits pending" on public.service_applications;
create policy "services: provider submits pending" on public.service_applications for insert to authenticated with check (provider_id = auth.uid() and status = 'pending');
drop policy if exists "services: admin reads all" on public.service_applications;
create policy "services: admin reads all" on public.service_applications for select to authenticated using (public.is_admin());
drop policy if exists "services: admin updates" on public.service_applications;
create policy "services: admin updates" on public.service_applications for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "services: admin deletes" on public.service_applications;
create policy "services: admin deletes" on public.service_applications for delete to authenticated using (public.is_admin());

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select on public.service_applications to anon, authenticated;
grant insert (provider_id, business_name, service_name, category, city, description, website, image_path) on public.service_applications to authenticated;
grant update, delete on public.service_applications to authenticated;

-- Optional cover image bucket. Public read is intentional: only an approved listing exposes its file path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-images', 'service-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "service images: provider uploads own folder" on storage.objects;
create policy "service images: provider uploads own folder" on storage.objects for insert to authenticated with check (bucket_id = 'service-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "service images: provider deletes own folder" on storage.objects;
create policy "service images: provider deletes own folder" on storage.objects for delete to authenticated using (bucket_id = 'service-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "service images: admin deletes" on storage.objects;
create policy "service images: admin deletes" on storage.objects for delete to authenticated using (bucket_id = 'service-images' and public.is_admin());

-- Make yourself an admin AFTER that account exists in Supabase Auth.
-- Replace the email only; do not put a password in SQL or frontend code.
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
