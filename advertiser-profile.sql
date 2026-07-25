-- =============================================
-- Anaar – Advertiser Profile Columns
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

alter table public.advertisers
  add column if not exists business_name     text,
  add column if not exists business_category text,
  add column if not exists business_url      text,
  add column if not exists gstin             text,
  add column if not exists gst_state         text;

-- Optional: index for GSTIN lookups / uniqueness
create unique index if not exists idx_advertisers_gstin
  on public.advertisers(gstin)
  where gstin is not null;
