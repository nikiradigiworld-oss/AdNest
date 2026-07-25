-- =============================================
-- Anaar – Support Chat Table
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  message    text not null,
  sender     text not null check (sender in ('user', 'admin')),
  is_read    boolean default false,
  created_at timestamptz default now()
);

alter table public.support_messages enable row level security;

-- Users can read their own thread (both sides)
drop policy if exists "chat_user_select" on public.support_messages;
create policy "chat_user_select" on public.support_messages
  for select using (
    auth.uid() = user_id
    or (auth.jwt()->'user_metadata'->>'role') = 'admin'
  );

-- Users can insert their own messages only
drop policy if exists "chat_user_insert" on public.support_messages;
create policy "chat_user_insert" on public.support_messages
  for insert with check (
    (auth.uid() = user_id and sender = 'user')
    or ((auth.jwt()->'user_metadata'->>'role') = 'admin' and sender = 'admin')
  );

-- Admin can mark messages as read
drop policy if exists "chat_admin_update" on public.support_messages;
create policy "chat_admin_update" on public.support_messages
  for update using (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'
    or auth.uid() = user_id
  );

-- Index for fast user lookups
create index if not exists idx_support_messages_user_id
  on public.support_messages(user_id, created_at desc);
