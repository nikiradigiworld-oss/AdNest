-- =============================================
-- Set admin role for adnest2026@gmail.com
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

-- Step 1: Set role = 'admin' in user_metadata
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
where email = 'adnest2026@gmail.com';

-- Step 2: Verify it worked
select id, email, raw_user_meta_data->>'role' as role
from auth.users
where email = 'adnest2026@gmail.com';
