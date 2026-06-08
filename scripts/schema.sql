-- ════════════════════════════════════════════════════════════════════════
-- Feenix AdTech — database schema
-- Run this in the Supabase SQL Editor (or `psql`) once per project.
-- Safe to re-run: every statement is idempotent.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────────────────
-- PROFILES  (1:1 with auth.users)
-- ────────────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  username    text not null unique,
  email       text not null,
  full_name   text,
  role        text not null default 'user'    check (role in ('user','admin')),
  status      text not null default 'pending' check (status in ('pending','approved','rejected'))
);
create index if not exists idx_profiles_status on profiles(status);
create index if not exists idx_profiles_role on profiles(role);

-- Auto-create a profile whenever a new auth user signs up. Username / full name
-- are passed through auth metadata at signup time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'full_name',
    'user',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- NOTE: RLS helper functions are defined AFTER the tables below, because
-- SQL-language functions are validated at creation time and these reference
-- tables (campaign_users, campaign_games, …) declared further down.

-- ────────────────────────────────────────────────────────────────────────
-- ASSETS
-- ────────────────────────────────────────────────────────────────────────
create table if not exists assets (
  id                  uuid primary key default uuid_generate_v4(),
  created_at          timestamptz not null default now(),
  uploaded_by         uuid references profiles(id) on delete set null,
  type                text not null check (type in ('image','video','audio')),
  title               text not null,
  original_filename   text not null,
  storage_path        text not null,
  thumb_path          text,
  mime                text not null,
  size_bytes          bigint not null default 0,
  optimized_size_bytes bigint,
  width               integer,
  height              integer,
  duration_seconds    numeric(10,2),
  tags                text[] not null default '{}'
);
create index if not exists idx_assets_type on assets(type);
create index if not exists idx_assets_created_at on assets(created_at desc);

-- ────────────────────────────────────────────────────────────────────────
-- GAMES + LOCATIONS  (admin-only inventory)
-- ────────────────────────────────────────────────────────────────────────
create table if not exists games (
  id                 uuid primary key default uuid_generate_v4(),
  created_at         timestamptz not null default now(),
  name               text not null,
  roblox_universe_id text,
  roblox_place_id    text,
  description        text,
  thumbnail_url      text,
  status             text not null default 'active' check (status in ('active','inactive'))
);

create table if not exists game_locations (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  game_id      uuid not null references games(id) on delete cascade,
  name         text not null,
  external_ref text
);
create index if not exists idx_game_locations_game on game_locations(game_id);

-- ────────────────────────────────────────────────────────────────────────
-- CAMPAIGNS + assignment join tables
-- ────────────────────────────────────────────────────────────────────────
create table if not exists campaigns (
  id           uuid primary key default uuid_generate_v4(),
  created_at   timestamptz not null default now(),
  name         text not null,
  status       text not null default 'draft' check (status in ('draft','active','paused','completed')),
  flight_start date,
  flight_end   date,
  created_by   uuid references profiles(id) on delete set null
);
create index if not exists idx_campaigns_status on campaigns(status);

create table if not exists campaign_users (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  primary key (campaign_id, user_id)
);
create index if not exists idx_campaign_users_user on campaign_users(user_id);

create table if not exists campaign_assets (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  asset_id    uuid not null references assets(id) on delete cascade,
  primary key (campaign_id, asset_id)
);

create table if not exists campaign_games (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  game_id     uuid not null references games(id) on delete cascade,
  primary key (campaign_id, game_id)
);

create table if not exists campaign_locations (
  campaign_id      uuid not null references campaigns(id) on delete cascade,
  game_location_id uuid not null references game_locations(id) on delete cascade,
  primary key (campaign_id, game_location_id)
);

-- ────────────────────────────────────────────────────────────────────────
-- ANALYTICS  (written by /api/ingest via the service role)
-- ────────────────────────────────────────────────────────────────────────
create table if not exists analytics_events (
  id          uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  game_id     uuid references games(id) on delete set null,
  location_id uuid references game_locations(id) on delete set null,
  event_type  text not null check (event_type in ('impression','click','unique_user')),
  count       integer not null default 1,
  ts          timestamptz not null default now()
);
create index if not exists idx_analytics_campaign_ts on analytics_events(campaign_id, ts);
create index if not exists idx_analytics_game on analytics_events(game_id);

-- ════════════════════════════════════════════════════════════════════════
-- RLS HELPER FUNCTIONS  (SECURITY DEFINER → no policy recursion)
-- Defined here, after all tables exist, so the SQL bodies validate cleanly.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

create or replace function public.can_access_campaign(cid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin() or exists (
    select 1 from public.campaign_users
    where campaign_id = cid and user_id = auth.uid()
  );
$$;

-- A game is readable by a user if they're assigned to a campaign that targets it
-- (so analytics can show game names) — the Games management tab is still gated to
-- admins at the route level.
create or replace function public.can_access_game(gid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin() or exists (
    select 1 from public.campaign_games cg
    join public.campaign_users cu on cu.campaign_id = cg.campaign_id
    where cg.game_id = gid and cu.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_location(lid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin() or exists (
    select 1 from public.campaign_locations cl
    join public.campaign_users cu on cu.campaign_id = cl.campaign_id
    where cl.game_location_id = lid and cu.user_id = auth.uid()
  );
$$;

-- ════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════
alter table profiles            enable row level security;
alter table assets              enable row level security;
alter table games               enable row level security;
alter table game_locations      enable row level security;
alter table campaigns           enable row level security;
alter table campaign_users      enable row level security;
alter table campaign_assets     enable row level security;
alter table campaign_games      enable row level security;
alter table campaign_locations  enable row level security;
alter table analytics_events    enable row level security;

-- Helper to drop+recreate a policy idempotently is verbose, so we guard each.

-- PROFILES: see your own; admins see all. Mutations are admin-only (and the
-- app performs role/status changes through the service role).
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- ASSETS: any approved user can view; only admins write.
drop policy if exists assets_select on assets;
create policy assets_select on assets for select using (public.is_approved());
drop policy if exists assets_insert on assets;
create policy assets_insert on assets for insert with check (public.is_admin());
drop policy if exists assets_update on assets;
create policy assets_update on assets for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists assets_delete on assets;
create policy assets_delete on assets for delete using (public.is_admin());

-- GAMES + LOCATIONS: readable by admins and by users assigned to a campaign that
-- targets the game/location; only admins may create/update/delete.
drop policy if exists games_select on games;
create policy games_select on games for select using (public.can_access_game(id));
drop policy if exists games_write on games;
create policy games_write on games for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists game_locations_select on game_locations;
create policy game_locations_select on game_locations for select
  using (public.is_admin() or public.can_access_location(id));
drop policy if exists game_locations_write on game_locations;
create policy game_locations_write on game_locations for all
  using (public.is_admin()) with check (public.is_admin());

-- CAMPAIGNS: visible to admins and assigned users; only admins mutate.
drop policy if exists campaigns_select on campaigns;
create policy campaigns_select on campaigns for select using (public.can_access_campaign(id));
drop policy if exists campaigns_write on campaigns;
create policy campaigns_write on campaigns for all
  using (public.is_admin()) with check (public.is_admin());

-- JOIN TABLES: read if you can access the campaign; only admins mutate.
drop policy if exists campaign_users_select on campaign_users;
create policy campaign_users_select on campaign_users for select
  using (public.is_admin() or user_id = auth.uid());
drop policy if exists campaign_users_write on campaign_users;
create policy campaign_users_write on campaign_users for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists campaign_assets_select on campaign_assets;
create policy campaign_assets_select on campaign_assets for select
  using (public.can_access_campaign(campaign_id));
drop policy if exists campaign_assets_write on campaign_assets;
create policy campaign_assets_write on campaign_assets for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists campaign_games_select on campaign_games;
create policy campaign_games_select on campaign_games for select
  using (public.can_access_campaign(campaign_id));
drop policy if exists campaign_games_write on campaign_games;
create policy campaign_games_write on campaign_games for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists campaign_locations_select on campaign_locations;
create policy campaign_locations_select on campaign_locations for select
  using (public.can_access_campaign(campaign_id));
drop policy if exists campaign_locations_write on campaign_locations;
create policy campaign_locations_write on campaign_locations for all
  using (public.is_admin()) with check (public.is_admin());

-- ANALYTICS: read if you can access the campaign. Writes happen only through
-- the service role (ingestion endpoint / seed), which bypasses RLS — so there
-- is intentionally no insert policy here.
drop policy if exists analytics_select on analytics_events;
create policy analytics_select on analytics_events for select
  using (public.can_access_campaign(campaign_id));

-- ════════════════════════════════════════════════════════════════════════
-- STORAGE
-- Create two PUBLIC buckets named `assets` and `thumbnails` in the Supabase
-- dashboard (Storage → New bucket → Public). Ad creatives are served to game
-- clients anyway, so public read is appropriate; uploads/deletes are performed
-- server-side with the service role after an admin check, and in-app access
-- control is enforced by the `assets` table policies above.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- ROBLOX OPEN CLOUD PUBLISHING
-- Adds per-asset Roblox publish/moderation tracking + a service-role-only
-- settings table for the shared Open Cloud API key & creator account.
-- ════════════════════════════════════════════════════════════════════════

-- Per-asset Roblox state (idempotent — `assets` already exists).
alter table assets add column if not exists roblox_status text not null default 'not_published'
  check (roblox_status in ('not_published','uploading','processing','reviewing','approved','rejected','failed'));
alter table assets add column if not exists roblox_asset_id bigint;
alter table assets add column if not exists roblox_operation_id text;
alter table assets add column if not exists roblox_error text;
alter table assets add column if not exists roblox_synced_at timestamptz;

-- Singleton org settings. The Open Cloud API key lives here. RLS is enabled
-- with NO policies, so the anon/publishable client can never read it — only the
-- service role (server actions) touches this table.
create table if not exists app_settings (
  id                      text primary key default 'global',
  roblox_api_key          text,
  roblox_creator_user_id  bigint,
  updated_at              timestamptz not null default now(),
  updated_by              uuid references profiles(id) on delete set null
);
alter table app_settings enable row level security;
-- (intentionally no policies — service-role only)
insert into app_settings (id) values ('global') on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- DYNAMIC LOCATIONS + INTERACTIVE ACTIONS
-- Supports the Roblox handler auto-registering ad locations, and tying a
-- campaign's creative to an in-game interaction (proximity prompt → click).
-- ════════════════════════════════════════════════════════════════════════

-- Unique key so the Roblox handler can idempotently register locations by
-- (game, external_ref). Postgres treats NULLs as distinct, so manually-created
-- locations with a null external_ref are unaffected.
create unique index if not exists ux_game_locations_game_ref
  on game_locations(game_id, external_ref);

-- Optional per-(campaign,asset) interaction. action_type null = passive ad.
alter table campaign_assets add column if not exists action_type text
  check (action_type is null or action_type in ('proximity'));
alter table campaign_assets add column if not exists action_text text;
alter table campaign_assets add column if not exists action_max_distance integer;
alter table campaign_assets add column if not exists action_hold_duration numeric(5,2);
