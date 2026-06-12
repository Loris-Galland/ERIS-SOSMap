-- Fixes critical gaps in existing RLS policies (found while auditing the
-- live database, which already had RLS enabled with a partial set of
-- policies):
--
-- 1. sos_alerts had "Autoriser select anonymes sos" / "Autoriser update
--    anonymes sos" (USING true) - any unauthenticated request could read
--    or modify EVERY SOS alert (names, GPS, medical data...). Nothing in
--    the app relies on anonymous read/update of sos_alerts (guest mode
--    only inserts), so these are dropped. The existing
--    "Autoriser inserts anonymes sos" policy is kept for guest SOS.
--
-- 2. hazards had "Enable delete for authenticated users" (auth.role() =
--    'authenticated') - any logged-in user could delete any hazard, not
--    just their own. Replaced by an owner-scoped delete policy;
--    hazards_delete_admin already covers admin deletion.
--
-- 3. user_profiles had "Users can manage their own profile" (ALL) and
--    "user_profiles_update_own" (UPDATE), neither with a with_check,
--    allowing a user to set their own is_admin = true. Replaced by an
--    update-own policy that preserves the caller's current is_admin value.

-- sos_alerts: remove anonymous read/write of all alerts
drop policy if exists "Autoriser select anonymes sos" on public.sos_alerts;
drop policy if exists "Autoriser update anonymes sos" on public.sos_alerts;

-- hazards: remove "any authenticated user can delete any hazard"
drop policy if exists "Enable delete for authenticated users" on public.hazards;

create policy "hazards_delete_own"
  on public.hazards
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- user_profiles: remove update policies without with_check (is_admin
-- self-escalation), replace with an owner-scoped update that cannot
-- change is_admin. "Users can manage their own profile" (ALL) also
-- covered DELETE for the owner (used by account deletion), so a
-- dedicated delete-own policy is added to preserve that.
drop policy if exists "Users can manage their own profile" on public.user_profiles;
drop policy if exists "user_profiles_update_own" on public.user_profiles;

create policy "user_profiles_update_own"
  on public.user_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select is_admin from public.user_profiles where id = auth.uid())
  );

create policy "user_profiles_delete_own"
  on public.user_profiles
  for delete
  to authenticated
  using (auth.uid() = id);
