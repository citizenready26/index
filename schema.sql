-- The Index — supabase/schema.sql
-- Run this entire file once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to re-run: it drops and recreates its own objects first.

-- ============================================================
-- Clean slate (safe to re-run while you're setting this up)
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists services_status_guard on public.services;
drop function if exists public.handle_new_user();
drop function if exists public.guard_service_status_change();
drop table if exists public.services;
drop table if exists public.profiles;

-- ============================================================
-- Tables
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'provider' check (role in ('provider', 'admin')),
  business_name text,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category text not null,
  description text not null,
  website_url text,
  contact_info text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index services_status_idx on public.services (status);
create index services_owner_idx on public.services (owner_id);

-- ============================================================
-- Auto-create a profile row whenever someone signs up
-- ============================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, business_name)
  values (new.id, new.raw_user_meta_data ->> 'business_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Stop non-admins from changing a service's status directly.
-- (RLS lets an owner UPDATE their own row for edits; this trigger
-- blocks that same UPDATE from silently approving/rejecting itself.)
-- ============================================================

create function public.guard_service_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();

  if new.status is distinct from old.status and coalesce(caller_role, '') <> 'admin' then
    raise exception 'Only an admin can change a service''s status.';
  end if;

  return new;
end;
$$;

create trigger services_status_guard
  before update on public.services
  for each row execute function public.guard_service_status_change();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.services enable row level security;

-- profiles: everyone can read profiles (needed to show "Verified" info,
-- and so the admin check on the client can resolve); a user can only
-- ever update their own row, and can never grant themselves admin.
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can update their own profile, but not their role"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- services: public/anon visitors and signed-in users can see approved
-- listings; owners can also see their own pending/rejected listings;
-- admins can see everything.
create policy "approved services are publicly readable"
  on public.services for select
  using (
    status = 'approved'
    or owner_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Any signed-in user can submit a service for themselves, always starting pending.
create policy "signed-in users can submit their own service"
  on public.services for insert
  with check (owner_id = auth.uid() and status = 'pending');

-- Owners can edit their own listing's content; admins can update anything
-- (including status). The trigger above stops owners from self-approving.
create policy "owners and admins can update services"
  on public.services for update
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Owners can delete their own listing; admins can delete any.
create policy "owners and admins can delete services"
  on public.services for delete
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================================
-- Make yourself an admin
-- Run this AFTER you've signed up through auth.html with your own email.
-- ============================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'you@example.com');
