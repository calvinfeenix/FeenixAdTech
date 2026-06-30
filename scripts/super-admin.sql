-- ════════════════════════════════════════════════════════════════════════
-- Feenix AdTech — super-admin flag
-- Paste into the Supabase SQL editor and Run.
--
-- Adds an is_super_admin flag to profiles. A super admin is just a normal admin
-- that can ALSO remove users (and is the only role shown the Settings tab).
-- FEENIX is promoted to super admin. Promote others later with the same UPDATE.
-- ════════════════════════════════════════════════════════════════════════
alter table profiles add column if not exists is_super_admin boolean not null default false;
update profiles set is_super_admin = true where username = 'FEENIX';
