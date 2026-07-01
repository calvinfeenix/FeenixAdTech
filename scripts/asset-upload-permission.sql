-- ════════════════════════════════════════════════════════════════════════
-- Feenix AdTech — asset-upload permission
-- Paste into the Supabase SQL editor and Run.
--
-- Adds a per-user `can_upload_assets` flag. Uploading assets used to be implicit
-- for every admin; it's now an explicit permission that SUPER ADMINS grant or
-- revoke in the Users screen. Super admins can always upload regardless.
--
-- Additive + idempotent — safe on the live DB. Existing admins default to FALSE,
-- so after running this a super admin must grant upload access to whoever needs
-- it (grant yourself/others in the Users screen).
-- ════════════════════════════════════════════════════════════════════════

alter table profiles add column if not exists can_upload_assets boolean not null default false;
