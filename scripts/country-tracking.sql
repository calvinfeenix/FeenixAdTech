-- ════════════════════════════════════════════════════════════════════════
-- Feenix AdTech — player-country tracking
-- Paste this whole block into the Supabase SQL editor and Run.
--
-- 1) Adds a nullable `country` column to analytics_events (ISO 3166-1 alpha-2,
--    e.g. "US"). Older / un-updated SDKs simply omit it -> stays null. Idempotent.
-- 2) Replaces campaign_analytics() so its JSON also includes `byCountry`
--    (impressions grouped by country). SECURITY DEFINER, same access gating.
--
-- Safe to run on a live DB: additive column + function replace, no data loss.
-- ════════════════════════════════════════════════════════════════════════

alter table analytics_events add column if not exists country text;
create index if not exists idx_analytics_country on analytics_events(country);

drop function if exists public.campaign_analytics(uuid[]);
drop function if exists public.campaign_analytics(uuid[], timestamptz);

create or replace function public.campaign_analytics(p_campaign_ids uuid[], p_from timestamptz default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select id from unnest(p_campaign_ids) as t(id)
    where public.can_access_campaign(id)
  ),
  ev as (
    select * from analytics_events
    where campaign_id in (select id from allowed)
      and (p_from is null or ts >= p_from)
  ),
  totals as (
    select
      coalesce(sum(count) filter (where event_type = 'impression'), 0)  as impressions,
      coalesce(sum(count) filter (where event_type = 'click'), 0)        as clicks,
      coalesce(sum(count) filter (where event_type = 'unique_user'), 0)  as unique_users
    from ev
  ),
  daily as (
    select
      to_char((ts at time zone 'UTC'), 'YYYY-MM-DD') as date,
      coalesce(sum(count) filter (where event_type = 'impression'), 0)  as impressions,
      coalesce(sum(count) filter (where event_type = 'click'), 0)        as clicks,
      coalesce(sum(count) filter (where event_type = 'unique_user'), 0)  as unique_users
    from ev group by 1 order by 1
  ),
  by_game as (
    select coalesce(g.name, 'Unattributed') as game, sum(ev.count) as impressions
    from ev left join games g on g.id = ev.game_id
    where ev.event_type = 'impression' group by 1 order by 2 desc
  ),
  by_loc as (
    select coalesce(l.name, 'Unattributed') as location, sum(ev.count) as impressions
    from ev left join game_locations l on l.id = ev.location_id
    where ev.event_type = 'impression' group by 1 order by 2 desc
  ),
  by_country as (
    select coalesce(nullif(ev.country, ''), 'Unknown') as country, sum(ev.count) as impressions
    from ev
    where ev.event_type = 'impression' group by 1 order by 2 desc
  )
  select jsonb_build_object(
    'impressions', (select impressions from totals),
    'clicks',      (select clicks from totals),
    'uniqueUsers', (select unique_users from totals),
    'ctr', case when (select impressions from totals) > 0
                then round((select clicks::numeric from totals) / (select impressions from totals), 6)
                else 0 end,
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
                'date', date, 'impressions', impressions, 'clicks', clicks, 'uniqueUsers', unique_users))
              from daily), '[]'::jsonb),
    'byGame', coalesce((select jsonb_agg(jsonb_build_object('game', game, 'impressions', impressions))
              from by_game), '[]'::jsonb),
    'byLocation', coalesce((select jsonb_agg(jsonb_build_object('location', location, 'impressions', impressions))
              from by_loc), '[]'::jsonb),
    'byCountry', coalesce((select jsonb_agg(jsonb_build_object('country', country, 'impressions', impressions))
              from by_country), '[]'::jsonb)
  );
$$;

grant execute on function public.campaign_analytics(uuid[], timestamptz) to anon, authenticated, service_role;
