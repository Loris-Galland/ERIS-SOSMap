-- Row Level Security for the sos_alerts table.
-- Users can only see and create their own alerts (admins can see all).
-- Direct updates are limited to the alert owner (e.g. revoking their own
-- alert) - admin status changes go through the update_sos_alert_status
-- SECURITY DEFINER function instead, see 0003_update_sos_alert_status.sql.

alter table public.sos_alerts enable row level security;

create policy "sos_alerts_select_own_or_admin"
  on public.sos_alerts
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "sos_alerts_insert_own"
  on public.sos_alerts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "sos_alerts_update_own"
  on public.sos_alerts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
