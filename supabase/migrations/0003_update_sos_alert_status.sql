-- SECURITY DEFINER function allowing admins to change the status of any
-- SOS alert (e.g. acknowledge/resolve). Mirrors the existing
-- toggle_user_admin_role pattern: it checks is_admin server-side before
-- writing, so the admin dashboard cannot be tricked into updating alerts
-- it doesn't own via the regular sos_alerts_update_own RLS policy.

create or replace function public.update_sos_alert_status(alert_id uuid, new_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
begin
  select is_admin into caller_is_admin
  from public.user_profiles
  where id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    raise exception 'Access denied: admin privileges required';
  end if;

  update public.sos_alerts
  set status = new_status
  where id = alert_id;

  return found;
end;
$$;

grant execute on function public.update_sos_alert_status(uuid, text) to authenticated;
