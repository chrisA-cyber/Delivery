-- A retake manifest can refer to the same capture in several accepted intervals.
-- Deduplicate paths before evaluating volatile cleanup timestamps.
create or replace function public.tombstone_camera() returns trigger
language plpgsql set search_path='' as $$
begin
  insert into public.cleanup_camera_objects(storage_path,delete_after,retain_until)
  select paths.path,clock_timestamp(),clock_timestamp()+interval '24 hours'
  from (select distinct s->>'path' as path from jsonb_array_elements(old.manifest) s) paths
  on conflict(storage_path) do update set
    delete_after=least(cleanup_camera_objects.delete_after,excluded.delete_after),
    retain_until=greatest(cleanup_camera_objects.retain_until,excluded.retain_until);
  return old;
end;
$$;
