-- Row Level Security for the user_profiles table.
-- Users can read/update their own profile (admins can read all), but
-- cannot change their own is_admin flag - that must go through the
-- toggle_user_admin_role SECURITY DEFINER function.

alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own_or_admin"
  on public.user_profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.is_admin = true
    )
  );

create policy "user_profiles_insert_own"
  on public.user_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

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
