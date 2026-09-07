-- Player-owned scene sources and preparation jobs, served by the existing media worker.
create table public.say_imports (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null check (owner_key ~ '^(user:[a-f0-9-]{36}|guest:[a-f0-9]{64})$'),
  user_id uuid references public.profiles(id) on delete cascade,
  request_key uuid not null,
  status text not null default 'queued' check (status in ('queued','fetching','source-ready','processing','ready','publishing','published','failed')),
  source_url text,
  title text not null default 'Your custom scene',
  creator text not null default 'Original creator',
  source_duration double precision check (source_duration between 1 and 180),
  source_mime text not null default 'video/mp4',
  media_key text not null check (media_key ~ '^[a-f0-9]{48}$'),
  excerpt_start double precision not null default 0 check (excerpt_start >= 0),
  excerpt_end double precision not null default 0,
  cues jsonb not null default '[]' check (jsonb_typeof(cues) = 'array'),
  assets jsonb not null default '{}' check (jsonb_typeof(assets) = 'object'),
  integrity jsonb not null default '{}' check (jsonb_typeof(integrity) = 'object'),
  error_message text,
  published_clip_id text references public.say_clip_versions(id),
  job_kind text default 'fetch' check (job_kind in ('fetch','prepare')),
  job_attempts integer not null default 0 check (job_attempts between 0 and 3),
  lease_token uuid,
  lease_expires_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_key, request_key),
  check (excerpt_end >= excerpt_start and excerpt_end - excerpt_start <= 45.1)
);
create index say_import_owner_history on public.say_imports(owner_key,created_at desc);
create index say_import_jobs on public.say_imports(created_at) where job_kind is not null and deleted_at is null;
create index say_import_expiry on public.say_imports(expires_at) where expires_at is not null and deleted_at is null;
alter table public.say_imports enable row level security;
revoke all on public.say_imports from anon,authenticated;
grant all on public.say_imports to service_role;

alter table public.say_clip_versions add column owner_key text;
alter table public.say_clip_versions add column custom_import_id uuid references public.say_imports(id) on delete set null;
create index say_clip_custom_owner on public.say_clip_versions(owner_key) where owner_key is not null;
create index say_clip_import on public.say_clip_versions(custom_import_id) where custom_import_id is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('delivery-scenes','delivery-scenes',false,83886080,array['video/mp4','video/webm','video/quicktime','video/x-matroska','video/ogg','application/octet-stream','audio/wav','audio/mp4','image/jpeg'])
on conflict(id) do nothing;

create function public.claim_say_import(p_lease_seconds integer default 360) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result public.say_imports;
begin
  update public.say_imports set status='failed',job_kind=null,lease_token=null,lease_expires_at=null,
    error_message='Preparation was interrupted. Retry this import.'
  where job_kind is not null and job_attempts>=3 and lease_expires_at<now() and deleted_at is null;
  with candidate as (
    select id from public.say_imports
    where job_kind is not null and job_attempts<3 and deleted_at is null
      and (expires_at is null or expires_at>now())
      and (lease_expires_at is null or lease_expires_at<now())
    order by created_at for update skip locked limit 1
  )
  update public.say_imports i set lease_token=gen_random_uuid(),
    lease_expires_at=now()+make_interval(secs=>greatest(60,least(600,p_lease_seconds))),
    job_attempts=job_attempts+1,
    status=case when job_kind='fetch' then 'fetching' else 'processing' end
  from candidate where i.id=candidate.id returning i.* into result;
  if result.id is null then return null; end if;
  return to_jsonb(result);
end;
$$;
revoke all on function public.claim_say_import(integer) from public,anon,authenticated;
grant execute on function public.claim_say_import(integer) to service_role;
comment on table public.say_imports is 'Private custom sources. Stable media capabilities are disclosed only to owners or through an explicitly shared scene.';

-- Keep the immutable manifest and its media pointers in one transaction. The row
-- lock also serializes publication against deletion and expired-lease recovery.
create function public.publish_say_import(
  p_id uuid, p_owner_key text, p_lease_token uuid, p_manifest jsonb,
  p_assets jsonb, p_integrity jsonb, p_cues jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  target public.say_imports;
  existing public.say_clip_versions;
  clip_slug text := 'custom-' || p_id::text;
  version_id text := 'custom-' || p_id::text || ':v1';
begin
  select * into target from public.say_imports where id=p_id for update;
  if not found or target.owner_key is distinct from p_owner_key or target.deleted_at is not null
    or (target.expires_at is not null and target.expires_at<=now()) then
    raise exception using errcode='P0001', message='SCENE_NOT_FOUND';
  end if;
  if target.user_id is not null and exists (
    select 1 from public.account_deletion_jobs where user_id=target.user_id
  ) then
    raise exception using errcode='P0001', message='SCENE_NOT_FOUND';
  end if;
  if target.published_clip_id is not null then
    select * into existing from public.say_clip_versions where id=target.published_clip_id;
    if not found or not existing.enabled or existing.owner_key is distinct from p_owner_key then
      raise exception using errcode='P0001', message='SCENE_NOT_FOUND';
    end if;
    return existing.manifest;
  end if;
  if target.status<>'publishing' or target.lease_token is distinct from p_lease_token
    or p_lease_token is null or target.lease_expires_at is null or target.lease_expires_at<=now() then
    raise exception using errcode='P0001', message='SCENE_PUBLISH_LEASE_LOST';
  end if;
  if p_manifest->>'id' is distinct from clip_slug or p_manifest->>'version' is distinct from 'v1'
    or jsonb_typeof(p_assets) is distinct from 'object' or jsonb_typeof(p_integrity) is distinct from 'object'
    or jsonb_typeof(p_cues) is distinct from 'array' then
    raise exception using errcode='22023', message='SCENE_MANIFEST_INVALID';
  end if;
  insert into public.say_clip_versions(id,clip_id,version,manifest,owner_key,custom_import_id)
  values(version_id,clip_slug,'v1',p_manifest,p_owner_key,p_id);
  update public.say_imports set status='published',title=p_manifest->>'title',
    assets=p_assets,integrity=p_integrity,cues=p_cues,published_clip_id=version_id,
    error_message=null,job_kind=null,lease_token=null,lease_expires_at=null,
    expires_at=case when user_id is not null then null else expires_at end
  where id=p_id;
  return p_manifest;
end;
$$;
revoke all on function public.publish_say_import(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_say_import(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;
