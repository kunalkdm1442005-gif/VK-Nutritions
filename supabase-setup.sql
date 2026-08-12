-- Run this once in Supabase Dashboard -> SQL Editor.
-- It securely creates each public profile from auth.users and rejects duplicate mobiles/emails.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  mobile text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists mobile text;
alter table public.profiles add column if not exists first_name text not null default '';
alter table public.profiles add column if not exists last_name text not null default '';
alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_email_lower_unique on public.profiles (lower(email));
create unique index if not exists profiles_mobile_unique on public.profiles (mobile);

alter table public.profiles enable row level security;
drop policy if exists "Users read their own profile" on public.profiles;
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users read their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_vk_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, email, mobile)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    lower(new.email),
    new.raw_user_meta_data ->> 'mobile'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_vk on auth.users;
create trigger on_auth_user_created_vk
  after insert on auth.users for each row execute procedure public.handle_vk_new_user();

-- A generic availability result prevents duplicate registration before account creation.
-- The trigger and unique indexes above remain the definitive race-safe protection.
create or replace function public.vk_registration_available(registration_email text, registration_mobile text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (
    select 1 from public.profiles
    where lower(email) = lower(registration_email) or mobile = registration_mobile
  );
$$;
revoke all on function public.vk_registration_available(text, text) from public;
grant execute on function public.vk_registration_available(text, text) to anon, authenticated;
