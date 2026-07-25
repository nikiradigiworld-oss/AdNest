-- =============================================
-- AdNest – Site Config Table
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

create table if not exists public.site_config (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

alter table public.site_config enable row level security;

-- Anyone can read (public pages need social links without auth)
drop policy if exists "config_public_read" on public.site_config;
create policy "config_public_read" on public.site_config
  for select using (true);

-- Only admin can insert / update / delete
drop policy if exists "config_admin_write" on public.site_config;
create policy "config_admin_write" on public.site_config
  for all using (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'
  );

-- Seed default social_links row (all empty)
insert into public.site_config(key, value)
values ('social_links', '{"facebook":"","instagram":"","youtube":"","twitter":"","whatsapp":"","linkedin":"","telegram":""}')
on conflict (key) do nothing;
