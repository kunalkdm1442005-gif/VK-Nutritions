-- VK Nutrition: run this file once in Supabase Dashboard -> SQL Editor.
-- It is the database security layer for email OTP, customer data, orders and history.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  mobile text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists first_name text not null default '';
alter table public.profiles add column if not exists last_name text not null default '';
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists mobile text;
create unique index if not exists profiles_email_lower_unique on public.profiles (lower(email));
create unique index if not exists profiles_mobile_unique on public.profiles (mobile);

create table if not exists public.order_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','processing','shipped','delivered','cancelled')),
  created_at timestamptz not null default now()
);
create table if not exists public.view_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  product_price numeric(12,2) not null check (product_price >= 0),
  viewed_at timestamptz not null default now()
);
create table if not exists public.login_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.order_history enable row level security;
alter table public.view_history enable row level security;
alter table public.login_events enable row level security;

drop policy if exists "Users read their own profile" on public.profiles;
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users read their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users read own orders" on public.order_history;
drop policy if exists "Users create own orders" on public.order_history;
create policy "Users read own orders" on public.order_history for select using (auth.uid() = user_id);
create policy "Users create own orders" on public.order_history for insert with check (auth.uid() = user_id);

drop policy if exists "Users read own views" on public.view_history;
drop policy if exists "Users create own views" on public.view_history for select using (auth.uid() = user_id);
create policy "Users read own views" on public.view_history for select using (auth.uid() = user_id);
create policy "Users create own views" on public.view_history for insert with check (auth.uid() = user_id);

drop policy if exists "Users read own login events" on public.login_events;
drop policy if exists "Users create own login events" on public.login_events;
create policy "Users read own login events" on public.login_events for select using (auth.uid() = user_id);
create policy "Users create own login events" on public.login_events for insert with check (auth.uid() = user_id);

-- This trigger executes inside the Auth transaction. Duplicate email/mobile values abort
-- registration before any customer profile is created, including concurrent sign-up attempts.
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
create trigger on_auth_user_created_vk after insert on auth.users for each row execute procedure public.handle_vk_new_user();

-- Pre-flight checks only improve the message. The trigger + indexes above are authoritative.
create or replace function public.vk_registration_available(registration_email text, registration_mobile text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (
    select 1 from public.profiles
    where lower(email) = lower(registration_email) or mobile = registration_mobile
  );
$$;
create or replace function public.vk_email_mobile_match(login_email text, login_mobile text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where lower(email) = lower(login_email) and mobile = login_mobile
  );
$$;
revoke all on function public.vk_registration_available(text, text) from public;
revoke all on function public.vk_email_mobile_match(text, text) from public;
grant execute on function public.vk_registration_available(text, text) to anon, authenticated;
grant execute on function public.vk_email_mobile_match(text, text) to anon, authenticated;

-- Account deletion is only allowed for the authenticated account itself.
create or replace function public.delete_user_account()
returns void language plpgsql security definer set search_path = auth, public as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
