-- =============================================
-- Anaar – CPC (Cost Per Click) for Image & Video Ads
-- Run in: Supabase Dashboard → SQL Editor
-- =============================================

-- Track one click per user per ad
create table if not exists public.ad_clicks (
  id            uuid primary key default gen_random_uuid(),
  ad_id         uuid references public.ads(id) on delete cascade not null,
  viewer_id     uuid references auth.users(id) on delete cascade not null,
  adv_debit     numeric(10,4),
  viewer_credit numeric(10,4),
  admin_credit  numeric(10,4),
  clicked_at    timestamptz default now(),
  unique(ad_id, viewer_id)
);

alter table public.ad_clicks enable row level security;

drop policy if exists "click_viewer_select" on public.ad_clicks;
create policy "click_viewer_select" on public.ad_clicks
  for select using (
    auth.uid() = viewer_id
    or (auth.jwt()->'user_metadata'->>'role') = 'admin'
  );

drop policy if exists "click_viewer_insert" on public.ad_clicks;
create policy "click_viewer_insert" on public.ad_clicks
  for insert with check (auth.uid() = viewer_id);

create index if not exists idx_ad_clicks_viewer on public.ad_clicks(viewer_id, ad_id);
create index if not exists idx_ad_clicks_ad    on public.ad_clicks(ad_id);

-- pricing_model column on ads table
alter table public.ads add column if not exists pricing_model text default 'cpm';

-- ── RPC: record_ad_click (Image CPC + Video CPC) ────────
-- Image: ₹0.30/click → viewer ₹0.15 (300 coins), admin ₹0.15
-- Video: ₹0.50/click → viewer ₹0.25 (500 coins), admin ₹0.25
create or replace function public.record_ad_click(
  p_viewer_id uuid,
  p_ad_id     uuid
) returns jsonb language plpgsql security definer as $$
declare
  v_adv_id     uuid;
  v_ad_type    text;
  v_wallet     numeric;
  v_click_cost numeric;
  v_viewer_cut numeric;
  v_coins      int;
begin
  -- Block re-clicks
  if exists (
    select 1 from public.ad_clicks
    where ad_id = p_ad_id and viewer_id = p_viewer_id
  ) then
    return jsonb_build_object('success', false, 'message', 'Already clicked this ad');
  end if;

  -- Get ad + advertiser; only active CPC ad types
  select a.ad_type, adv.id, adv.wallet_balance
  into v_ad_type, v_adv_id, v_wallet
  from public.ads a
  join public.advertisers adv on adv.id = a.advertiser_id
  where a.id = p_ad_id
    and a.status = 'active'
    and a.ad_type in ('image', 'video', 'social_link', 'app_website');

  if not found then
    return jsonb_build_object('success', false, 'message', 'Ad not available');
  end if;

  -- Set rates by ad type
  -- Image:        ₹0.30/click  → viewer ₹0.15 (300 coins),  admin ₹0.15
  -- Video:        ₹0.50/click  → viewer ₹0.25 (500 coins),  admin ₹0.25
  -- Social Link:  ₹0.80/like   → viewer ₹0.40 (800 coins),  admin ₹0.40
  -- App/Website:  ₹2.00/click  → viewer ₹0.75 (1500 coins), admin ₹1.25
  if v_ad_type = 'image' then
    v_click_cost := 0.30; v_viewer_cut := 0.15; v_coins := 300;
  elsif v_ad_type = 'video' then
    v_click_cost := 0.50; v_viewer_cut := 0.25; v_coins := 500;
  elsif v_ad_type = 'social_link' then
    v_click_cost := 0.80; v_viewer_cut := 0.40; v_coins := 800;
  elsif v_ad_type = 'app_website' then
    v_click_cost := 2.00; v_viewer_cut := 0.75; v_coins := 1500;
  end if;

  -- Check advertiser wallet
  if v_wallet < v_click_cost then
    return jsonb_build_object('success', false, 'message', 'Ad paused – advertiser has insufficient balance');
  end if;

  -- Deduct advertiser wallet
  update public.advertisers
  set wallet_balance = wallet_balance - v_click_cost
  where id = v_adv_id;

  -- Credit viewer coins + cash
  update public.viewers
  set total_coins = coalesce(total_coins, 0) + v_coins,
      total_cash  = coalesce(total_cash,  0) + v_viewer_cut
  where user_id = p_viewer_id;

  -- Record click (deduplication guard)
  insert into public.ad_clicks(ad_id, viewer_id, adv_debit, viewer_credit, admin_credit)
  values (p_ad_id, p_viewer_id, v_click_cost, v_viewer_cut, v_click_cost - v_viewer_cut);

  -- Increment ad click counter
  update public.ads
  set views_delivered = coalesce(views_delivered, 0) + 1
  where id = p_ad_id;

  -- Coin transaction log
  insert into public.coin_transactions(viewer_id, ad_id, coins, transaction_type)
  values (p_viewer_id, p_ad_id, v_coins, 'click')
  on conflict do nothing;

  return jsonb_build_object(
    'success', true,
    'coins',   v_coins,
    'cash',    v_viewer_cut,
    'ad_type', v_ad_type
  );
end;
$$;

-- Keep old name as alias for backwards compat
create or replace function public.record_photo_click(p_viewer_id uuid, p_ad_id uuid)
returns jsonb language sql security definer as $$
  select public.record_ad_click(p_viewer_id, p_ad_id);
$$;
