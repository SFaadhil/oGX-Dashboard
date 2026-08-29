-- ============================================================================
-- AIESEC in India - oGX Talent Hub
-- Migration 003: your first sign-in account.
--
-- EDIT THE FOUR VALUES BELOW, then run.
-- Re-running updates the existing row instead of failing, so it is safe to
-- run again if you want to change the password later.
--
-- Note: passwords are stored in plaintext on `managers` (inherited from the
-- reference app's login model). Do not reuse a password you use elsewhere.
-- ============================================================================

insert into public.managers (first_name, last_name, email, password, key_area, ogt)
values (
  'oGX',                       -- first name
  'Admin',                     -- last name
  'ogx.admin@aiesec.in',       -- email you will sign in with
  'change-me',                 -- password you will sign in with
  'Administrator',             -- keep as 'Administrator' or use 'LCVP oGX'
  'oGT 1'
)
on conflict (email) do update
  set first_name = excluded.first_name,
      last_name  = excluded.last_name,
      password   = excluded.password,
      key_area   = excluded.key_area,
      ogt        = excluded.ogt;
