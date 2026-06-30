-- ════════════════════════════════════════════════════════════════════════
-- Feenix AdTech — per-game analytics (for the Games page accordion)
-- Paste into the Supabase SQL editor and Run.
--
-- Returns { "<game_id>": { impressions, clicks, uniqueUsers }, ... } aggregated
-- across all campaigns, for ADMINS only. SECURITY DEFINER so it bypasses the
-- per-row RLS that would otherwise time out on a large events table.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.games_analytics()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'approved')
    then coalesce((
      select jsonb_object_agg(game_id::text, jsonb_build_object(
               'impressions', impressions, 'clicks', clicks, 'uniqueUsers', unique_users))
      from (
        select game_id,
          coalesce(sum(count) filter (where event_type = 'impression'), 0)  as impressions,
          coalesce(sum(count) filter (where event_type = 'click'), 0)        as clicks,
          coalesce(sum(count) filter (where event_type = 'unique_user'), 0)  as unique_users
        from analytics_events
        where game_id is not null
        group by game_id
      ) t
    ), '{}'::jsonb)
    else '{}'::jsonb
  end;
$$;

grant execute on function public.games_analytics() to anon, authenticated, service_role;
