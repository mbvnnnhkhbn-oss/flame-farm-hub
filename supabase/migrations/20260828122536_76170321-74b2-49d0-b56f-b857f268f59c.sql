
update public.settings
set value = value || jsonb_build_object(
  'reward_per_ad', 5,
  'daily_limit', 10,
  'cooldown_seconds', 10,
  'reward_per_interstitial', 5,
  'interstitial_daily_limit', 10,
  'watch_seconds', 10
), updated_at = now()
where key = 'ads';

update public.settings
set value = value || jsonb_build_object('min_withdraw_usdt', 0.1), updated_at = now()
where key = 'economy';

insert into public.settings (key, value)
values ('withdraw_requirements', jsonb_build_object(
  'daily_ads_required', 10,
  'referrals_required', 2,
  'all_tasks_required', true,
  'ads_before_submit', 5
))
on conflict (key) do update set value = excluded.value, updated_at = now();
