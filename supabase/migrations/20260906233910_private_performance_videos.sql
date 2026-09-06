-- Private derived media. The application owns authentication and content admission;
-- SQL repeats ownership, source lifetime and publication fencing at every commit.
create table public.public_assignment_links (
  code text primary key check (code ~ '^[a-f0-9]{12}$'),
  fingerprint text not null unique check (fingerprint ~ '^[a-f0-9]{64}$'),
  mode text not null check (mode in ('classic','switch','say-it-back')),
  assignment jsonb not null check (jsonb_typeof(assignment) = 'object' and assignment->>'mode' = mode),
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);
create function public.guard_public_assignment_link() returns trigger
language plpgsql set search_path = '' as $$
begin
  if row(new.code,new.fingerprint,new.mode,new.assignment,new.created_at) is distinct from
     row(old.code,old.fingerprint,old.mode,old.assignment,old.created_at) then
    raise exception using errcode='55000', message='ASSIGNMENT_LINK_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger public_assignment_link_immutable before update on public.public_assignment_links
for each row execute function public.guard_public_assignment_link();

-- Upload-only Classic receipts support private, unscored and guest exports.
-- Existing ranked deliveries and judging calls are not involved.
create table public.classic_video_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_owner_hash text,
  owner_key text not null,
  attempt_key text not null check (length(attempt_key) between 8 and 128),
  request_fingerprint text not null check (length(request_fingerprint) between 1 and 128),
  audio_hash text not null check (audio_hash ~ '^[a-f0-9]{64}$'),
  recording_path text not null unique,
  audio_mime text not null,
  duration_ms integer not null check (duration_ms between 250 and 30000),
  assignment_snapshot jsonb not null check (jsonb_typeof(assignment_snapshot)='object' and assignment_snapshot->>'mode'='classic'),
  display_name text check (length(display_name) between 1 and 48),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  deleted_at timestamptz,
  recording_deleted_at timestamptz,
  unique(owner_key,attempt_key),
  check ((user_id is not null and guest_owner_hash is null and expires_at is null and owner_key='user:'||user_id::text)
    or (user_id is null and guest_owner_hash ~ '^[a-f0-9]{64}$' and expires_at is not null and owner_key='guest:'||guest_owner_hash))
);
create index classic_video_attempts_owner_history on public.classic_video_attempts(owner_key,created_at desc);
create index classic_video_attempts_expiry on public.classic_video_attempts(expires_at) where expires_at is not null;
create function public.guard_classic_video_attempt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if row(new.id,new.attempt_key,new.request_fingerprint,new.audio_hash,new.audio_mime,new.duration_ms,new.assignment_snapshot,new.display_name,new.created_at)
    is distinct from row(old.id,old.attempt_key,old.request_fingerprint,old.audio_hash,old.audio_mime,old.duration_ms,old.assignment_snapshot,old.display_name,old.created_at) then
    raise exception using errcode='55000',message='CLASSIC_VIDEO_ATTEMPT_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger classic_video_attempt_immutable before update on public.classic_video_attempts
for each row execute function public.guard_classic_video_attempt();
create trigger classic_video_attempt_account_containment before insert or update on public.classic_video_attempts
for each row execute function public.reject_delivery_during_account_deletion();

create table public.video_exports (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('delivery','classic_video_attempt','switch_attempt','say_attempt','group_take')),
  mode text not null check (mode in ('classic','switch','say-it-back')),
  attempt_id uuid not null,
  owner_key text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  input jsonb not null check (jsonb_typeof(input)='object' and octet_length(input::text)<=100000),
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot)='object'),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  layout_version text not null check (length(layout_version) between 1 and 80),
  include_score boolean not null,
  include_name boolean not null,
  state text not null default 'queued' check (state in ('queued','rendering','ready','failed','cancelled')),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 3),
  storage_path text,
  bytes bigint check (bytes between 1 and 104857600),
  duration_ms integer check (duration_ms between 250 and 30000),
  failure_code text check (failure_code ~ '^[A-Z][A-Z0-9_]{0,79}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  unique(source_kind,attempt_id,input_hash),
  check ((user_id is not null and owner_key='user:'||user_id::text) or (user_id is null and owner_key ~ '^guest:[a-f0-9]{64}$')),
  check ((state='rendering') = (lease_token is not null and lease_expires_at is not null)),
  check (state<>'ready' or (storage_path is not null and bytes is not null and duration_ms is not null and completed_at is not null))
);
create index video_exports_claim on public.video_exports(state,created_at) where state in ('queued','rendering');
create index video_exports_owner on public.video_exports(owner_key,created_at desc);
create index video_exports_expiry on public.video_exports(expires_at);

-- No source/user FK: these tombstones survive cascades. Every possible upload
-- path is registered BEFORE upload. Repeated deletion for 24 hours exceeds the
-- bounded 10 minute lease/render and upload deadline, including a crashed worker.
create table public.cleanup_video_export_objects (
  storage_path text primary key check (storage_path ~ '^exports/[a-f0-9-]{36}/[a-f0-9-]{36}\.mp4$'),
  delete_after timestamptz not null,
  retain_until timestamptz not null,
  last_deleted_at timestamptz,
  attempts integer not null default 0 check (attempts>=0)
);
create index cleanup_video_export_objects_due on public.cleanup_video_export_objects(delete_after);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('delivery-exports','delivery-exports',false,104857600,array['video/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.public_assignment_links enable row level security;
alter table public.classic_video_attempts enable row level security;
alter table public.video_exports enable row level security;
alter table public.cleanup_video_export_objects enable row level security;
revoke all on public.public_assignment_links,public.classic_video_attempts,public.video_exports,public.cleanup_video_export_objects from public,anon,authenticated;
grant all on public.public_assignment_links,public.classic_video_attempts,public.video_exports,public.cleanup_video_export_objects to service_role;

create function public.video_export_source(p_source_kind text,p_attempt_id uuid,p_owner_key text,p_user_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare source jsonb; source_mode text; source_expiry timestamptz;
begin
  if p_user_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-account-delete:'||p_user_id::text,0));
    if p_owner_key <> 'user:'||p_user_id::text or not exists(select 1 from public.profiles where id=p_user_id)
      or exists(select 1 from public.account_deletion_jobs where user_id=p_user_id)
      or exists(select 1 from public.account_restrictions where user_id=p_user_id and kind in ('recording','publish','profile-limit','profile-remove')
        and starts_at<=clock_timestamp() and (ends_at is null or ends_at>clock_timestamp())) then return null; end if;
  elsif p_owner_key !~ '^guest:[a-f0-9]{64}$' then return null;
  end if;
  -- BEFORE DELETE/containment triggers acquire the same source lock. No row lock
  -- here: taking a source row lock after this advisory lock would invert DELETE.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-video-source:'||p_source_kind||':'||p_attempt_id::text,0));
  if p_source_kind='delivery' then
    select to_jsonb(d) into source from public.deliveries d join public.prompts p on p.id=d.prompt_id
    where d.id=p_attempt_id and d.user_id=p_user_id and p.rating<>'mature' and p.state='published'
      and d.state in ('processing','judged','failed') and d.recording_path is not null
      and not d.moderation_labels && array['publish-rejected','publish-review','mature-content','account-deletion'];
    source_mode := 'classic';
  elsif p_source_kind='classic_video_attempt' then
    select to_jsonb(a) into source from public.classic_video_attempts a where a.id=p_attempt_id and a.owner_key=p_owner_key
      and a.user_id is not distinct from p_user_id and a.deleted_at is null and a.assignment_snapshot->>'rating' in ('everyone','teen')
      and not exists(select 1 from public.prompts p where p.id::text=a.assignment_snapshot->>'promptId' and (p.state<>'published' or p.rating='mature'));
    source_mode := 'classic';
  elsif p_source_kind='switch_attempt' then
    select to_jsonb(a) into source from public.switch_attempts a where a.id=p_attempt_id and a.owner_key=p_owner_key
      and a.user_id is not distinct from p_user_id and a.moderation_state not in ('rejected','review')
      and a.challenge_snapshot->>'rating' in ('everyone','teen');
    source_mode := 'switch';
  elsif p_source_kind='say_attempt' then
    select to_jsonb(a) into source from public.say_attempts a join public.say_clip_versions c on c.id=a.clip_version_id
    where a.id=p_attempt_id and a.owner_key=p_owner_key and a.user_id is not distinct from p_user_id
      and a.moderation_state not in ('rejected','review') and c.enabled and a.clip_snapshot=c.manifest
      and a.clip_snapshot->>'rating' in ('everyone','teen')
      and a.clip_snapshot->'source'->>'license' in ('CC BY 3.0','Public domain in the United States');
    source_mode := 'say-it-back';
  elsif p_source_kind='group_take' then
    select to_jsonb(t) into source from public.challenge_group_takes t
    join public.challenge_group_members m on m.id=t.member_id join public.challenges c on c.id=t.challenge_id
    where t.id=p_attempt_id and t.mode='classic' and m.user_id is not distinct from p_user_id
      and ((p_user_id is not null and p_owner_key='user:'||m.user_id::text) or
        (p_user_id is null and p_owner_key='guest:'||m.guest_owner_hash))
      and t.moderation_state not in ('rejected','review') and c.group_assignment->>'rating' in ('everyone','teen')
      and not exists(select 1 from public.prompts p where p.id::text=c.group_assignment->>'promptId' and (p.state<>'published' or p.rating='mature'));
    source_mode := 'classic';
  end if;
  if source is null or source->>'recording_path' is null then return null; end if;
  source_expiry := (source->>'expires_at')::timestamptz;
  if source_expiry is not null and source_expiry<=clock_timestamp() then return null; end if;
  return jsonb_build_object('mode',source_mode,'recordingPath',source->>'recording_path','audioHash',source->>'audio_hash',
    'durationMs',source->'duration_ms','expiresAt',source_expiry);
end;
$$;

create function public.activate_video_export_cleanup(p_path text) returns void
language sql set search_path = '' as $$
  insert into public.cleanup_video_export_objects(storage_path,delete_after,retain_until)
  select p_path,clock_timestamp(),clock_timestamp()+interval '24 hours' where p_path is not null
  on conflict(storage_path) do update set delete_after=least(public.cleanup_video_export_objects.delete_after,clock_timestamp()),
    retain_until=greatest(public.cleanup_video_export_objects.retain_until,clock_timestamp()+interval '24 hours');
$$;

create function public.guard_video_export() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' then
    if row(new.id,new.source_kind,new.mode,new.attempt_id,new.owner_key,new.user_id,new.input,new.source_snapshot,new.input_hash,new.layout_version,new.include_score,new.include_name,new.created_at,new.expires_at)
      is distinct from row(old.id,old.source_kind,old.mode,old.attempt_id,old.owner_key,old.user_id,old.input,old.source_snapshot,old.input_hash,old.layout_version,old.include_score,old.include_name,old.created_at,old.expires_at) then
      raise exception using errcode='55000',message='VIDEO_EXPORT_INPUT_IMMUTABLE';
    end if;
    new.updated_at := clock_timestamp();
  end if;
  if tg_op='DELETE' or (new.state in ('failed','cancelled') and old.state is distinct from new.state)
    or (tg_op='UPDATE' and old.storage_path is distinct from new.storage_path) then
    perform public.activate_video_export_cleanup(old.storage_path);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger video_export_guard before update or delete on public.video_exports
for each row execute function public.guard_video_export();

create function public.cancel_video_exports(p_source_kind text,p_attempt_id uuid) returns integer
language plpgsql set search_path = '' as $$
declare affected integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-video-source:'||p_source_kind||':'||p_attempt_id::text,0));
  update public.video_exports set state='cancelled',lease_token=null,lease_expires_at=null,failure_code='SOURCE_UNAVAILABLE'
  where source_kind=p_source_kind and attempt_id=p_attempt_id and state<>'cancelled';
  get diagnostics affected=row_count;
  return affected;
end;
$$;

create function public.contain_source_video_exports() returns trigger
language plpgsql set search_path = '' as $$
declare v_source_kind text := tg_argv[0];
begin
  if tg_op='DELETE' then
    perform public.cancel_video_exports(v_source_kind,old.id);
    -- Erase snapshots/names along with their source; tombstones survive independently.
    delete from public.video_exports where video_exports.source_kind=v_source_kind and attempt_id=old.id;
    return old;
  end if;
  if (to_jsonb(old)->>'recording_path') is distinct from (to_jsonb(new)->>'recording_path')
    or (to_jsonb(old)->>'owner_key') is distinct from (to_jsonb(new)->>'owner_key')
    or (to_jsonb(old)->>'user_id') is distinct from (to_jsonb(new)->>'user_id')
    or to_jsonb(new)->>'state'='removed'
    or to_jsonb(new)->>'moderation_state' in ('rejected','review')
    or to_jsonb(new)->>'deleted_at' is not null
    or (to_jsonb(new)->'moderation_labels') ?| array['publish-rejected','publish-review','mature-content','account-deletion']
    or ((to_jsonb(new)->>'expires_at')::timestamptz<=clock_timestamp()) then
    perform public.cancel_video_exports(v_source_kind,old.id);
  end if;
  return new;
end;
$$;
create trigger deliveries_contain_video_exports before update or delete on public.deliveries for each row execute function public.contain_source_video_exports('delivery');
create trigger classic_attempts_contain_video_exports before update or delete on public.classic_video_attempts for each row execute function public.contain_source_video_exports('classic_video_attempt');
create trigger switch_attempts_contain_video_exports before update or delete on public.switch_attempts for each row execute function public.contain_source_video_exports('switch_attempt');
create trigger say_attempts_contain_video_exports before update or delete on public.say_attempts for each row execute function public.contain_source_video_exports('say_attempt');
create trigger group_takes_contain_video_exports before update or delete on public.challenge_group_takes for each row execute function public.contain_source_video_exports('group_take');

create function public.contain_account_video_exports() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.video_exports set state='cancelled',lease_token=null,lease_expires_at=null,failure_code='SOURCE_UNAVAILABLE'
  where user_id=new.user_id and state<>'cancelled';
  return new;
end;
$$;
create trigger account_deletion_contain_video_exports after insert on public.account_deletion_jobs
for each row execute function public.contain_account_video_exports();

-- Source withdrawal and explicit account restrictions also revoke already-ready
-- files immediately, with physical erasure delegated to the same durable sweep.
create function public.contain_restricted_video_exports() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name='account_restrictions' then
    if new.kind in ('recording','publish','profile-limit','profile-remove') and new.starts_at<=clock_timestamp()
      and (new.ends_at is null or new.ends_at>clock_timestamp()) then
      update public.video_exports set state='cancelled',lease_token=null,lease_expires_at=null,failure_code='SOURCE_UNAVAILABLE'
      where user_id=new.user_id and state<>'cancelled';
    end if;
  elsif tg_table_name='say_clip_versions' then
    if not new.enabled then
      update public.video_exports set state='cancelled',lease_token=null,lease_expires_at=null,failure_code='SOURCE_UNAVAILABLE'
      where source_kind='say_attempt' and attempt_id in(select id from public.say_attempts where clip_version_id=new.id) and state<>'cancelled';
    end if;
  elsif tg_table_name='prompts' then
    if new.state<>'published' or new.rating='mature' then
      update public.video_exports e set state='cancelled',lease_token=null,lease_expires_at=null,failure_code='SOURCE_UNAVAILABLE'
      where e.mode='classic' and e.state<>'cancelled' and (
        (e.source_kind='delivery' and e.attempt_id in(select d.id from public.deliveries d where d.prompt_id=new.id))
        or e.input->'assignment'->>'promptId'=new.id::text);
    end if;
  end if;
  return new;
end;
$$;
create trigger restrictions_contain_video_exports after insert or update on public.account_restrictions
for each row execute function public.contain_restricted_video_exports();
create trigger say_clip_withdrawal_contain_video_exports after update of enabled on public.say_clip_versions
for each row execute function public.contain_restricted_video_exports();
create trigger prompt_withdrawal_contain_video_exports after update of state,rating on public.prompts
for each row execute function public.contain_restricted_video_exports();

create function public.request_video_export(p_source_kind text,p_attempt_id uuid,p_owner_key text,p_user_id uuid,p_mode text,
  p_input jsonb,p_input_hash text,p_layout_version text,p_include_score boolean,p_include_name boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare source jsonb; job public.video_exports; source_expiry timestamptz;
begin
  source := public.video_export_source(p_source_kind,p_attempt_id,p_owner_key,p_user_id);
  if source is null or source->>'mode' is distinct from p_mode
    or source->>'recordingPath' is distinct from p_input->>'recordingPath'
    or (source->>'audioHash' is not null and source->>'audioHash' is distinct from p_input->>'audioHash') then
    raise exception using errcode='55000',message='EXPORT_SOURCE_UNAVAILABLE';
  end if;
  select * into job from public.video_exports where source_kind=p_source_kind and attempt_id=p_attempt_id and input_hash=p_input_hash for update;
  if found then
    if job.owner_key<>p_owner_key or job.input is distinct from p_input or job.include_score is distinct from p_include_score
      or job.include_name is distinct from p_include_name or job.layout_version is distinct from p_layout_version then
      raise exception using errcode='55000',message='EXPORT_INPUT_CONFLICT';
    end if;
    if job.expires_at>clock_timestamp() and job.state<>'cancelled' then
      if job.state='failed' and job.attempts<3 then
        update public.video_exports set state='queued',failure_code=null where id=job.id returning * into job;
      end if;
      return to_jsonb(job);
    end if;
    delete from public.video_exports where id=job.id;
  end if;
  if (select count(*) from public.video_exports where owner_key=p_owner_key and state in ('queued','rendering'))>=3 then
    raise exception using errcode='55000',message='EXPORT_QUEUE_FULL';
  end if;
  source_expiry := least(clock_timestamp()+interval '7 days',(source->>'expiresAt')::timestamptz);
  insert into public.video_exports(source_kind,mode,attempt_id,owner_key,user_id,input,source_snapshot,input_hash,layout_version,include_score,include_name,expires_at)
  values(p_source_kind,p_mode,p_attempt_id,p_owner_key,p_user_id,p_input,source-'expiresAt',p_input_hash,p_layout_version,p_include_score,p_include_name,source_expiry)
  returning * into job;
  return to_jsonb(job);
end;
$$;

create function public.expire_video_exports(p_limit integer default 100) returns integer
language plpgsql set search_path = '' as $$
declare affected integer;
begin
  with expired as(select id from public.video_exports where expires_at<=clock_timestamp() order by expires_at for update skip locked limit greatest(1,least(p_limit,1000)))
  delete from public.video_exports where id in(select id from expired);
  get diagnostics affected=row_count;
  return affected;
end;
$$;

create function public.claim_video_export(p_lease_seconds integer default 600) returns jsonb
language plpgsql set search_path = '' as $$
declare job public.video_exports; source jsonb; token uuid; path text;
begin
  if p_lease_seconds not between 60 and 600 then raise exception using errcode='22023',message='EXPORT_LEASE_INVALID'; end if;
  -- A single transaction mutex gives the existing app processes one global slot.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-video-worker',0));
  if exists(select 1 from public.video_exports where state='rendering' and lease_expires_at>clock_timestamp()) then return null; end if;
  -- Do not hold job row locks while taking account/source locks (deletion takes
  -- account/source first). Global slot serialization protects candidate claims.
  for job in select * from public.video_exports where expires_at>clock_timestamp() and (state='queued' or (state='rendering' and lease_expires_at<=clock_timestamp())) order by created_at limit 30 loop
    source := public.video_export_source(job.source_kind,job.attempt_id,job.owner_key,job.user_id);
    if source is null or (source-'expiresAt') is distinct from job.source_snapshot then
      perform public.cancel_video_exports(job.source_kind,job.attempt_id);
      continue;
    end if;
    if job.attempts>=3 then
      update public.video_exports set state='failed',lease_token=null,lease_expires_at=null,failure_code='RENDER_INTERRUPTED' where id=job.id;
      continue;
    end if;
    token := gen_random_uuid();
    path := 'exports/'||job.id::text||'/'||token::text||'.mp4';
    update public.video_exports set state='rendering',lease_token=token,lease_expires_at=clock_timestamp()+pg_catalog.make_interval(secs=>p_lease_seconds),
      attempts=attempts+1,storage_path=path,started_at=clock_timestamp(),failure_code=null
    where id=job.id and state in ('queued','rendering') returning * into job;
    if not found then continue; end if;
    insert into public.cleanup_video_export_objects(storage_path,delete_after,retain_until)
    values(path,job.expires_at,job.expires_at+interval '24 hours');
    return to_jsonb(job);
  end loop;
  return null;
end;
$$;

create function public.renew_video_export_lease(p_export_id uuid,p_lease_token uuid,p_lease_seconds integer default 600) returns boolean
language plpgsql set search_path = '' as $$
declare job public.video_exports; source jsonb;
begin
  if p_lease_seconds not between 60 and 600 then return false; end if;
  select * into job from public.video_exports where id=p_export_id;
  if not found then return false; end if;
  source := public.video_export_source(job.source_kind,job.attempt_id,job.owner_key,job.user_id);
  if source is null or (source-'expiresAt') is distinct from job.source_snapshot then return false; end if;
  update public.video_exports set lease_expires_at=least(clock_timestamp()+pg_catalog.make_interval(secs=>p_lease_seconds),started_at+interval '10 minutes')
  where id=p_export_id and lease_token=p_lease_token and state='rendering' and lease_expires_at>clock_timestamp()
    and expires_at>clock_timestamp() and started_at+interval '10 minutes'>clock_timestamp();
  return found;
end;
$$;

create function public.publish_video_export(p_export_id uuid,p_lease_token uuid,p_bytes bigint,p_duration_ms integer) returns boolean
language plpgsql set search_path = '' as $$
declare job public.video_exports; source jsonb;
begin
  if p_bytes not between 1 and 104857600 or p_duration_ms not between 250 and 30000 then return false; end if;
  select * into job from public.video_exports where id=p_export_id;
  if not found then return false; end if;
  source := public.video_export_source(job.source_kind,job.attempt_id,job.owner_key,job.user_id);
  if source is null or (source-'expiresAt') is distinct from job.source_snapshot then
    perform public.cancel_video_exports(job.source_kind,job.attempt_id); return false;
  end if;
  update public.video_exports set state='ready',lease_token=null,lease_expires_at=null,bytes=p_bytes,duration_ms=p_duration_ms,completed_at=clock_timestamp(),failure_code=null
  where id=p_export_id and state='rendering' and lease_token=p_lease_token and lease_expires_at>clock_timestamp() and expires_at>clock_timestamp();
  return found;
end;
$$;

create function public.fail_video_export(p_export_id uuid,p_lease_token uuid,p_failure_code text) returns boolean
language plpgsql set search_path = '' as $$
begin
  update public.video_exports set state='failed',lease_token=null,lease_expires_at=null,
    failure_code=case when p_failure_code ~ '^[A-Z][A-Z0-9_]{0,79}$' then p_failure_code else 'RENDER_FAILED' end
  where id=p_export_id and state='rendering' and lease_token=p_lease_token;
  return found;
end;
$$;

-- Trigger helpers are not public RPCs. Invoker RPCs need both table privileges
-- and EXECUTE; only the existing server service role has either.
revoke all on function public.guard_public_assignment_link(),public.guard_classic_video_attempt(),public.video_export_source(text,uuid,text,uuid),
 public.activate_video_export_cleanup(text),public.guard_video_export(),public.cancel_video_exports(text,uuid),public.contain_source_video_exports(),
 public.contain_account_video_exports(),public.contain_restricted_video_exports(),public.request_video_export(text,uuid,text,uuid,text,jsonb,text,text,boolean,boolean),public.expire_video_exports(integer),
 public.claim_video_export(integer),public.renew_video_export_lease(uuid,uuid,integer),public.publish_video_export(uuid,uuid,bigint,integer),
 public.fail_video_export(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.video_export_source(text,uuid,text,uuid),public.activate_video_export_cleanup(text),public.cancel_video_exports(text,uuid),
 public.request_video_export(text,uuid,text,uuid,text,jsonb,text,text,boolean,boolean),public.expire_video_exports(integer),public.claim_video_export(integer),
 public.renew_video_export_lease(uuid,uuid,integer),public.publish_video_export(uuid,uuid,bigint,integer),public.fail_video_export(uuid,uuid,text) to service_role;

comment on table public.video_exports is 'Private immutable render jobs; one global lease, token-specific object paths and publication fences. No scoring provider calls.';
comment on table public.cleanup_video_export_objects is 'Durable private-object deletion receipts; repeated sweeping covers delayed uploads after source deletion or worker crash. No identifying snapshots survive source deletion.';
comment on table public.public_assignment_links is 'Public playable immutable assignment only. Never contains performance IDs, audio URLs or invitation/broadcast capabilities.';
