-- ════════════════════════════════════════════════════════════════════════
-- Feenix AdTech — analytics aggregation RPC  (REQUIRED for the dashboard)
-- Paste this whole block into the Supabase SQL editor and Run.
--
-- Why this exists:
--   The dashboard/campaign pages must NOT read raw analytics rows. Two reasons:
--   (1) PostgREST caps a plain select at 1000 rows (silently dropping recent
--       days), and (2) the row-level-security policy on analytics_events calls
--       can_access_campaign() PER ROW — with tens of thousands of events that
--       blows Postgres' statement timeout, so the query just fails.
--
--   This function aggregates entirely in SQL and returns one small JSON. It is
--   SECURITY DEFINER so the heavy aggregation BYPASSES per-row RLS (fast), but
--   it stays secure by first reducing the requested campaigns to only the ones
--   the caller may access — can_access_campaign() is called once per campaign
--   id (a handful), never per event. Days are bucketed in UTC.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.campaign_analytics(p_campaign_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    -- access check: one call per requested campaign, NOT per event
    select id from unnest(p_campaign_ids) as t(id)
    where public.can_access_campaign(id)
  ),
  ev as (
    select * from analytics_events where campaign_id in (select id from allowed)
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
              from by_loc), '[]'::jsonb)
  );
$$;

-- Let API roles call it (PostgREST RPC). The DEFINER body still gates access.
grant execute on function public.campaign_analytics(uuid[]) to anon, authenticated, service_role;
