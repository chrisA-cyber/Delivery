-- Say It Back supports 45-second scenes. Preserve the existing compatibility
-- bounds for Classic and Switch, whose application recorders remain 20 seconds.
alter table public.say_attempts drop constraint say_attempts_duration_ms_check;
alter table public.say_attempts add constraint say_attempts_duration_ms_check
  check (duration_ms between 250 and 45000);

alter table public.challenge_group_takes drop constraint challenge_group_takes_duration_ms_check;
alter table public.challenge_group_takes add constraint challenge_group_takes_duration_ms_check
  check (duration_ms between 250 and case when mode = 'say-it-back' then 45000 else 30000 end);

alter table public.video_exports drop constraint video_exports_duration_ms_check;
alter table public.video_exports add constraint video_exports_duration_ms_check
  check (duration_ms between 250 and case when mode = 'say-it-back' then 45000 else 30000 end);

-- These are personal downloads in private Storage. A Mature rating alone does
-- not revoke a player's own video. Existing public-feed and friend-sharing
-- admission, source ownership, moderation rejection and deletion stay intact.
-- Imported scenes carry an explicit server-written export decision in their
-- immutable catalog manifest; a client snapshot cannot grant that permission.

create or replace function public.video_export_source(p_source_kind text,p_attempt_id uuid,p_owner_key text,p_user_id uuid)
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
    where d.id=p_attempt_id and d.user_id=p_user_id and p.state='published'
      and d.state in ('processing','judged','failed') and d.recording_path is not null
      and not d.moderation_labels && array['publish-rejected','publish-review','account-deletion'];
    source_mode := 'classic';
  elsif p_source_kind='classic_video_attempt' then
    select to_jsonb(a) into source from public.classic_video_attempts a where a.id=p_attempt_id and a.owner_key=p_owner_key
      and a.user_id is not distinct from p_user_id and a.deleted_at is null and a.assignment_snapshot->>'rating' in ('everyone','teen','mature')
      and not exists(select 1 from public.prompts p where p.id::text=a.assignment_snapshot->>'promptId' and p.state<>'published');
    source_mode := 'classic';
  elsif p_source_kind='switch_attempt' then
    select to_jsonb(a) into source from public.switch_attempts a where a.id=p_attempt_id and a.owner_key=p_owner_key
      and a.user_id is not distinct from p_user_id and a.moderation_state not in ('rejected','review')
      and a.challenge_snapshot->>'rating' in ('everyone','teen','mature');
    source_mode := 'switch';
  elsif p_source_kind='say_attempt' then
    select to_jsonb(a) into source from public.say_attempts a join public.say_clip_versions c on c.id=a.clip_version_id
    where a.id=p_attempt_id and a.owner_key=p_owner_key and a.user_id is not distinct from p_user_id
      and a.moderation_state not in ('rejected','review') and c.enabled and a.clip_snapshot=c.manifest
      and a.clip_snapshot->>'rating' in ('everyone','teen','mature')
      and (c.manifest->'source'->'exportAllowed' = 'true'::jsonb
        or c.manifest->'source'->>'license' in ('CC BY 3.0','Public domain in the United States'));
    source_mode := 'say-it-back';
  elsif p_source_kind='group_take' then
    select to_jsonb(t) into source from public.challenge_group_takes t
    join public.challenge_group_members m on m.id=t.member_id join public.challenges c on c.id=t.challenge_id
    where t.id=p_attempt_id and t.mode='classic' and m.user_id is not distinct from p_user_id
      and ((p_user_id is not null and p_owner_key='user:'||m.user_id::text) or
        (p_user_id is null and p_owner_key='guest:'||m.guest_owner_hash))
      and t.moderation_state not in ('rejected','review') and c.group_assignment->>'rating' in ('everyone','teen','mature')
      and not exists(select 1 from public.prompts p where p.id::text=c.group_assignment->>'promptId' and p.state<>'published');
    source_mode := 'classic';
  end if;
  if source is null or source->>'recording_path' is null then return null; end if;
  source_expiry := (source->>'expires_at')::timestamptz;
  if source_expiry is not null and source_expiry<=clock_timestamp() then return null; end if;
  return jsonb_build_object('mode',source_mode,'recordingPath',source->>'recording_path','audioHash',source->>'audio_hash',
    'durationMs',source->'duration_ms','expiresAt',source_expiry);
end;
$$;

create or replace function public.publish_video_export(p_export_id uuid,p_lease_token uuid,p_bytes bigint,p_duration_ms integer) returns boolean
language plpgsql set search_path = '' as $$
declare job public.video_exports; source jsonb;
begin
  select * into job from public.video_exports where id=p_export_id;
  if not found or p_bytes is null or p_duration_ms is null
    or p_bytes not between 1 and 104857600
    or p_duration_ms not between 250 and (case when job.mode='say-it-back' then 45000 else 30000 end) then return false; end if;
  source := public.video_export_source(job.source_kind,job.attempt_id,job.owner_key,job.user_id);
  if source is null or (source-'expiresAt') is distinct from job.source_snapshot then
    perform public.cancel_video_exports(job.source_kind,job.attempt_id); return false;
  end if;
  update public.video_exports set state='ready',lease_token=null,lease_expires_at=null,bytes=p_bytes,duration_ms=p_duration_ms,completed_at=clock_timestamp(),failure_code=null
  where id=p_export_id and state='rendering' and lease_token=p_lease_token and lease_expires_at>clock_timestamp() and expires_at>clock_timestamp();
  return found;
end;
$$;

create or replace function public.contain_source_video_exports() returns trigger
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
    or (to_jsonb(new)->'moderation_labels') ?| array['publish-rejected','publish-review','account-deletion']
    or ((to_jsonb(new)->>'expires_at')::timestamptz<=clock_timestamp()) then
    perform public.cancel_video_exports(v_source_kind,old.id);
  end if;
  return new;
end;
$$;

create or replace function public.contain_restricted_video_exports() returns trigger
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
    if new.state<>'published' then
      update public.video_exports e set state='cancelled',lease_token=null,lease_expires_at=null,failure_code='SOURCE_UNAVAILABLE'
      where e.mode='classic' and e.state<>'cancelled' and (
        (e.source_kind='delivery' and e.attempt_id in(select d.id from public.deliveries d where d.prompt_id=new.id))
        or e.input->'assignment'->>'promptId'=new.id::text);
    end if;
  end if;
  return new;
end;
$$;
