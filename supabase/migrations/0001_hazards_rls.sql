-- Row Level Security for the hazards table.
-- Anyone authenticated can read hazards (shown on the shared map),
-- users can only report hazards under their own account, and deletion
-- is restricted to the hazard owner or an admin.

alter table public.hazards enable row level security;

create policy "hazards_select_all"
  on public.hazards
  for select
  to authenticated
  using (true);

create policy "hazards_insert_own"
  on public.hazards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "hazards_delete_own_or_admin"
  on public.hazards
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
