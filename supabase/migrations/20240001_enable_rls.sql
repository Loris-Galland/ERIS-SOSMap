-- Enable Row Level Security on all tables containing user data
ALTER TABLE public.sos_alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hazards              ENABLE ROW LEVEL SECURITY;

-- Helper: check if the caller is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ─── sos_alerts ───────────────────────────────────────────────────────────────
-- Users can insert their own alerts
CREATE POLICY "sos_alerts_insert_own" ON public.sos_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own alerts; admins can read all
CREATE POLICY "sos_alerts_select" ON public.sos_alerts
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Only admins can update alert status
CREATE POLICY "sos_alerts_update_admin" ON public.sos_alerts
  FOR UPDATE USING (public.is_admin());

-- No hard deletes — revoke is a status update (handled above)
CREATE POLICY "sos_alerts_no_delete" ON public.sos_alerts
  FOR DELETE USING (false);

-- ─── user_profiles ────────────────────────────────────────────────────────────
-- Each user manages their own profile
CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "user_profiles_insert_own" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update_own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ─── emergency_contacts ───────────────────────────────────────────────────────
CREATE POLICY "emergency_contacts_all_own" ON public.emergency_contacts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── hazards ──────────────────────────────────────────────────────────────────
-- Everyone can read hazards; authenticated users can insert; only admins can delete
CREATE POLICY "hazards_select_all" ON public.hazards
  FOR SELECT USING (true);

CREATE POLICY "hazards_insert_auth" ON public.hazards
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hazards_delete_admin" ON public.hazards
  FOR DELETE USING (public.is_admin());
