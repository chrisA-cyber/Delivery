-- Private camera companions use the existing source locks, ownership and worker.
create table public.performance_camera_media (
  source_kind text not null check(source_kind in ('delivery','classic_video_attempt','switch_attempt','say_attempt','group_take')),
  attempt_id uuid not null, owner_key text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  manifest jsonb not null check(jsonb_typeof(manifest)='array' and jsonb_array_length(manifest) between 1 and 32 and octet_length(manifest::text)<20000),
  ready boolean not null default false, created_at timestamptz not null default now(), expires_at timestamptz,
  primary key(source_kind,attempt_id),
  check ((user_id is not null and owner_key='user:'||user_id::text) or (user_id is null and owner_key ~ '^guest:[a-f0-9]{64}$'))
);
create index performance_camera_expiry on public.performance_camera_media(expires_at);
create index performance_camera_user on public.performance_camera_media(user_id) where user_id is not null;
create table public.cleanup_camera_objects (
  storage_path text primary key check(storage_path ~ '^camera/[a-f0-9-]{36}/[a-f0-9-]{36}/[0-9]{1,2}\.(mp4|webm)$'),
  delete_after timestamptz not null, retain_until timestamptz not null
);
create index cleanup_camera_due on public.cleanup_camera_objects(delete_after);
alter table public.performance_camera_media enable row level security;
alter table public.cleanup_camera_objects enable row level security;
revoke all on public.performance_camera_media,public.cleanup_camera_objects from public,anon,authenticated;
grant all on public.performance_camera_media,public.cleanup_camera_objects to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('delivery-camera','delivery-camera',false,33554432,array['video/webm','video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Private capture is independent of downloadable scene rights; every source
-- still has to be live and owned by the existing verified account/device.
create function public.camera_source(p_source_kind text,p_attempt_id uuid,p_owner_key text,p_user_id uuid)
returns jsonb language plpgsql set search_path='' as $$
declare source jsonb; table_name text;
begin
  if p_user_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-account-delete:'||p_user_id::text,0));
    if p_owner_key is distinct from 'user:'||p_user_id::text or exists(select 1 from public.account_deletion_jobs where user_id=p_user_id) then return null; end if;
  elsif p_owner_key !~ '^guest:[a-f0-9]{64}$' then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-video-source:'||p_source_kind||':'||p_attempt_id::text,0));
  table_name:=case p_source_kind when 'delivery' then 'deliveries' when 'classic_video_attempt' then 'classic_video_attempts' when 'switch_attempt' then 'switch_attempts' when 'say_attempt' then 'say_attempts' when 'group_take' then 'challenge_group_takes' end;
  if table_name is null then return null; end if;
  execute pg_catalog.format('select to_jsonb(t) from public.%I t where id=$1',table_name) into source using p_attempt_id;
  if source is null or source->>'recording_path' is null or source->>'deleted_at' is not null or source->>'state' in ('removed','deleted','rejected','hidden') or source->>'moderation_state' in ('removed','rejected','review') or (source->>'expires_at')::timestamptz<=clock_timestamp() then return null; end if;
  if p_source_kind='group_take' then
    if not exists(select 1 from public.challenge_group_members m join public.challenges c on c.id=m.challenge_id where m.id=(source->>'member_id')::uuid and m.user_id is not distinct from p_user_id and (case when m.user_id is not null then 'user:'||m.user_id::text else 'guest:'||m.guest_owner_hash end)=p_owner_key and m.hidden_at is null and c.group_replay_until>clock_timestamp()) then return null; end if;
  elsif coalesce(source->>'owner_key','user:'||(source->>'user_id')) is distinct from p_owner_key or (source->>'user_id')::uuid is distinct from p_user_id then return null; end if;
  return source;
end;
$$;
create function public.reserve_performance_camera(p_source_kind text,p_attempt_id uuid,p_owner_key text,p_user_id uuid,p_fingerprint text,p_manifest jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare source jsonb; existing public.performance_camera_media;
begin
  source:=public.camera_source(p_source_kind,p_attempt_id,p_owner_key,p_user_id);
  if source is null then raise exception using errcode='55000',message='CAMERA_SOURCE_UNAVAILABLE'; end if;
  select * into existing from public.performance_camera_media where source_kind=p_source_kind and attempt_id=p_attempt_id;
  if found then
    if existing.fingerprint<>p_fingerprint then raise exception using errcode='55000',message='CAMERA_CONFLICT'; end if;
    return to_jsonb(existing);
  end if;
  if exists(select 1 from jsonb_array_elements(p_manifest) s where (s->>'path') !~ ('^camera/'||p_attempt_id::text||'/[a-f0-9-]{36}/[0-9]{1,2}\.(mp4|webm)$')) then raise exception 'INVALID_CAMERA_PATH'; end if;
  insert into public.performance_camera_media(source_kind,attempt_id,owner_key,user_id,fingerprint,manifest,expires_at)
    values(p_source_kind,p_attempt_id,p_owner_key,p_user_id,p_fingerprint,p_manifest,(source->>'expires_at')::timestamptz) returning * into existing;
  return to_jsonb(existing);
end;
$$;
create function public.finish_performance_camera(p_source_kind text,p_attempt_id uuid,p_owner_key text,p_user_id uuid,p_fingerprint text)
returns boolean language plpgsql set search_path='' as $$
begin
  if public.camera_source(p_source_kind,p_attempt_id,p_owner_key,p_user_id) is null then return false; end if;
  update public.performance_camera_media set ready=true where source_kind=p_source_kind and attempt_id=p_attempt_id and fingerprint=p_fingerprint and owner_key=p_owner_key;
  return found;
end;
$$;
create function public.tombstone_camera() returns trigger language plpgsql set search_path='' as $$
begin
  insert into public.cleanup_camera_objects(storage_path,delete_after,retain_until)
  select distinct s->>'path',clock_timestamp(),clock_timestamp()+interval '24 hours' from jsonb_array_elements(old.manifest) s
  on conflict(storage_path) do update set delete_after=least(cleanup_camera_objects.delete_after,excluded.delete_after),retain_until=greatest(cleanup_camera_objects.retain_until,excluded.retain_until);
  return old;
end;
$$;
create trigger camera_cleanup before delete on public.performance_camera_media for each row execute function public.tombstone_camera();
create function public.contain_source_camera() returns trigger language plpgsql set search_path='' as $$
declare data jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-video-source:'||tg_argv[0]||':'||old.id::text,0));
  if tg_op='DELETE' then delete from public.performance_camera_media where source_kind=tg_argv[0] and attempt_id=old.id; return old; end if;
  data:=to_jsonb(new);
  if data->>'deleted_at' is not null or data->>'recording_path' is null or data->>'state' in ('removed','deleted') or (data->'moderation_labels') ? 'account-deletion' then
    delete from public.performance_camera_media where source_kind=tg_argv[0] and attempt_id=old.id;
  elsif data->>'user_id' is not null then
    update public.performance_camera_media set user_id=(data->>'user_id')::uuid,owner_key='user:'||(data->>'user_id'),expires_at=(data->>'expires_at')::timestamptz where source_kind=tg_argv[0] and attempt_id=old.id;
  end if;
  return new;
end;
$$;
create trigger delivery_camera before update or delete on public.deliveries for each row execute function public.contain_source_camera('delivery');
create trigger classic_camera before update or delete on public.classic_video_attempts for each row execute function public.contain_source_camera('classic_video_attempt');
create trigger switch_camera before update or delete on public.switch_attempts for each row execute function public.contain_source_camera('switch_attempt');
create trigger say_camera before update or delete on public.say_attempts for each row execute function public.contain_source_camera('say_attempt');
create trigger group_camera before update or delete on public.challenge_group_takes for each row execute function public.contain_source_camera('group_take');
create function public.claim_group_camera() returns trigger language plpgsql set search_path='' as $$
begin
  if new.user_id is not null and new.user_id is distinct from old.user_id then update public.performance_camera_media set user_id=new.user_id,owner_key='user:'||new.user_id::text where source_kind='group_take' and attempt_id in(select id from public.challenge_group_takes where member_id=new.id); end if;
  return new;
end;
$$;
create trigger group_member_camera after update of user_id on public.challenge_group_members for each row execute function public.claim_group_camera();
create function public.contain_account_camera() returns trigger language plpgsql set search_path='' as $$
begin delete from public.performance_camera_media where user_id=new.user_id; return new; end;
$$;
create trigger account_deletion_camera after insert on public.account_deletion_jobs for each row execute function public.contain_account_camera();
create function public.expire_performance_camera(p_limit integer default 30) returns void language plpgsql set search_path='' as $$
begin
  delete from public.performance_camera_media where (source_kind,attempt_id) in(select source_kind,attempt_id from public.performance_camera_media where expires_at<=clock_timestamp() or (not ready and created_at<clock_timestamp()-interval '24 hours') order by created_at limit greatest(1,least(p_limit,100)));
end;
$$;
revoke all on function public.camera_source(text,uuid,text,uuid),public.reserve_performance_camera(text,uuid,text,uuid,text,jsonb),public.finish_performance_camera(text,uuid,text,uuid,text),public.tombstone_camera(),public.contain_source_camera(),public.claim_group_camera(),public.contain_account_camera(),public.expire_performance_camera(integer) from public,anon,authenticated;
grant execute on function public.camera_source(text,uuid,text,uuid),public.reserve_performance_camera(text,uuid,text,uuid,text,jsonb),public.finish_performance_camera(text,uuid,text,uuid,text),public.expire_performance_camera(integer) to service_role;
