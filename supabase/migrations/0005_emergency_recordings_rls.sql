-- Row Level Security for the emergency_recordings table and the
-- emergency_recordings storage bucket. Recordings contain sensitive
-- audio captured during emergencies, so only the owner can upload and
-- only admins can read/delete them.

alter table public.emergency_recordings enable row level security;

create policy "emergency_recordings_select_admin"
  on public.emergency_recordings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "emergency_recordings_insert_own"
  on public.emergency_recordings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "emergency_recordings_delete_admin"
  on public.emergency_recordings
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Storage: files are stored as "<user_id>/<filename>".
create policy "emergency_recordings_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'emergency_recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "emergency_recordings_storage_select_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'emergency_recordings'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "emergency_recordings_storage_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'emergency_recordings'
    and exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
