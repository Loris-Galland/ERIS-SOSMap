-- RPC: toggle_user_admin_role
-- Allows an admin to promote or demote another user.
-- SECURITY DEFINER runs with the function owner's privileges,
-- but the body checks auth.uid() before writing.
CREATE OR REPLACE FUNCTION public.toggle_user_admin_role(
  target_user_id uuid,
  new_value       boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Only allow the caller to proceed if they are themselves an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: caller is not an admin';
  END IF;

  -- Prevent an admin from demoting themselves (safety guard)
  IF target_user_id = auth.uid() AND new_value = false THEN
    RAISE EXCEPTION 'Unauthorized: cannot remove your own admin role';
  END IF;

  UPDATE public.user_profiles
  SET is_admin = new_value
  WHERE id = target_user_id;
END;
$$;
