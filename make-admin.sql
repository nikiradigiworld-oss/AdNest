-- Run this in Supabase SQL Editor AFTER signing up with adnest2026@gmail.com
-- =============================================

-- 1. Update role in public users table
update public.users
  set role = 'admin'
  where email = 'adnest2026@gmail.com';

-- 2. Update auth metadata so the nav shows Admin button
update auth.users
  set raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
  where email = 'adnest2026@gmail.com';

-- Confirm
select id, email, role from public.users where email = 'adnest2026@gmail.com';
