-- Switch joins the existing private/community round capability boundary.
-- Existing assignments and scoring records stay immutable; beta scores remain
-- on Switch attempts/group receipts, never the ranked deliveries table.
alter table public.challenges drop constraint challenges_group_mode_check;
alter table public.challenges add constraint challenges_group_mode_check
  check (group_mode in ('classic','say-it-back','switch'));
alter table public.challenges add constraint group_switch_snapshot_check check (
  group_mode <> 'switch' or (
    (jsonb_typeof(group_assignment->'challenge') = 'object') is true
    and (length(group_assignment->'challenge'->>'id') between 1 and 80) is true
    and (length(group_assignment->'challenge'->>'version') between 1 and 80) is true
    and (jsonb_typeof(group_assignment->'challenge'->'cues') = 'array') is true
    and (jsonb_array_length(group_assignment->'challenge'->'cues') between 4 and 6) is true
    and (group_assignment->'challenge'->>'scoringVersion' = group_assignment->>'scoringVersion') is true
    and (group_assignment->'challenge'->>'rubricVersion' = group_assignment->>'rubricVersion') is true
    and (length(group_assignment->>'rubricVersion') between 1 and 80) is true
    and (group_assignment->'challenge'->>'rating' = group_assignment->>'rating') is true
  )
);
alter table public.challenge_group_takes
  add column switch_attempt_id uuid references public.switch_attempts(id) on delete set null;
create index challenge_group_takes_switch on public.challenge_group_takes(switch_attempt_id) where switch_attempt_id is not null;
alter table public.challenge_group_takes drop constraint challenge_group_takes_mode_check;
alter table public.challenge_group_takes add constraint challenge_group_takes_mode_check
  check (mode in ('classic','say-it-back','switch'));
-- Find only the legacy source-shape check; preserve score and moderation checks.
do $$ declare constraint_name text; begin
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.challenge_group_takes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%say_attempt_id%'
      and pg_get_constraintdef(oid) like '%recording_path%'
  loop execute format('alter table public.challenge_group_takes drop constraint %I',constraint_name); end loop;
end $$;
alter table public.challenge_group_takes add constraint group_take_source_check check (
  (mode = 'switch' and recording_path is null and say_attempt_id is null)
  or (mode = 'say-it-back' and recording_path is null and switch_attempt_id is null)
  or (mode = 'classic' and say_attempt_id is null and switch_attempt_id is null and recording_path is not null
    and audio_mime is not null and audio_hash is not null and duration_ms is not null and duration_ms <= 20000)
);

create or replace function public.guard_group_child() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare r public.challenges; m public.challenge_group_members; source public.say_attempts; switch_source public.switch_attempts;
  initial_user uuid; needs_account_lock boolean := false;
begin
  if tg_table_name = 'challenge_group_members' then
    if not public.lock_users_for_account_mutation(array[new.user_id]) then
      raise exception using errcode = '55000', message = 'ROUND_FORBIDDEN';
    end if;
  elsif tg_table_name = 'challenge_group_takes' then
    needs_account_lock := tg_op = 'INSERT' or (tg_op = 'UPDATE' and (
      new.score is distinct from old.score or new.moderation_state is distinct from old.moderation_state
      or new.recording_path is distinct from old.recording_path
      or new.audio_mime is distinct from old.audio_mime or new.audio_hash is distinct from old.audio_hash
      or new.duration_ms is distinct from old.duration_ms));
    if needs_account_lock then
      select user_id into initial_user from public.challenge_group_members where id = new.member_id;
      if not public.lock_users_for_account_mutation(array[initial_user]) then
        raise exception using errcode = '55000', message = 'ROUND_FORBIDDEN';
      end if;
    end if;
  end if;
  select * into r from public.challenges where id = new.challenge_id for update;
  if not found or r.group_mode is null then
    raise exception using errcode = '22023', message = 'ROUND_NOT_FOUND';
  end if;
  if tg_op = 'UPDATE' and new.challenge_id is distinct from old.challenge_id then
    raise exception using errcode = '22023', message = 'ROUND_ASSIGNMENT_IMMUTABLE';
  end if;
  if tg_table_name = 'challenge_group_members' then
    if tg_op = 'INSERT' and ((not r.community and (r.state <> 'open' or r.group_closes_at <= clock_timestamp())) or (r.community and r.community_phase = 'results')) then
      raise exception using errcode = '55000', message = 'ROUND_CLOSED';
    end if;
    if tg_op = 'INSERT' and r.group_invite_revoked_at is not null then
      raise exception using errcode = '55000', message = 'ROUND_INVITE_REVOKED';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.challenge_group_members where challenge_id = r.id) >= (case when r.community then 500 else 12 end) then
      raise exception using errcode = '55000', message = 'ROUND_FULL';
    end if;
    if new.submitted_take_id is not null and not exists (
      select 1 from public.challenge_group_takes t where t.id = new.submitted_take_id
        and t.member_id = new.id and t.challenge_id = new.challenge_id
    ) then
      raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
    end if;
  elsif tg_table_name = 'challenge_group_takes' then
    if needs_account_lock and initial_user is distinct from
      (select user_id from public.challenge_group_members where id = new.member_id) then
      -- A simultaneous guest claim changed the account-lock order. Retry after
      -- that claim rather than insert behind the account deletion barrier.
      raise exception using errcode = '40001', message = 'ROUND_CLAIM_CONFLICT';
    end if;
    if new.mode <> r.group_mode or new.scoring_version <> r.group_assignment->>'scoringVersion'
      or new.expires_at > r.created_at + interval '14 days' or new.expires_at <= new.created_at then
      raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
    end if;
    if tg_op = 'INSERT' and (r.state <> 'open' or r.group_closes_at <= clock_timestamp()) then
      raise exception using errcode = '55000', message = 'ROUND_CLOSED';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.challenge_group_takes where member_id = new.member_id) >= 20
      and not exists (select 1 from public.challenge_group_takes where member_id = new.member_id and attempt_key = new.attempt_key) then
      raise exception using errcode = '55000', message = 'ROUND_TAKE_LIMIT';
    end if;
    if tg_op = 'UPDATE' and (new.member_id <> old.member_id or new.mode <> old.mode
      or new.attempt_key <> old.attempt_key or new.request_fingerprint <> old.request_fingerprint
      or new.recording_path is distinct from old.recording_path
      or (new.say_attempt_id is distinct from old.say_attempt_id and new.say_attempt_id is not null)
      or (new.switch_attempt_id is distinct from old.switch_attempt_id and new.switch_attempt_id is not null)) then
      raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
    end if;
    if tg_op = 'INSERT' and new.mode = 'say-it-back' then
      select * into m from public.challenge_group_members where id = new.member_id;
      select * into source from public.say_attempts where id = new.say_attempt_id;
      if not found or source.clip_version_id is distinct from ((r.group_assignment->'clip'->>'id') || ':' || (r.group_assignment->'clip'->>'version'))
        or source.role_id <> r.group_assignment->>'roleId'
        or source.scoring_version <> new.scoring_version
        or not coalesce((m.user_id is not null and source.user_id = m.user_id)
          or (source.user_id is null and source.guest_owner_hash = m.guest_owner_hash),false) then
        raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
      end if;
    end if;
    if tg_op = 'INSERT' and new.mode = 'switch' then
      select * into m from public.challenge_group_members where id = new.member_id;
      select * into switch_source from public.switch_attempts where id = new.switch_attempt_id;
      if not found or switch_source.challenge_snapshot is distinct from (r.group_assignment->'challenge')
        or switch_source.challenge_version_id is distinct from ((r.group_assignment->'challenge'->>'id') || ':' || (r.group_assignment->'challenge'->>'version'))
        or switch_source.scoring_version <> new.scoring_version
        or not coalesce((m.user_id is not null and switch_source.user_id = m.user_id)
          or (switch_source.user_id is null and switch_source.guest_owner_hash = m.guest_owner_hash),false) then
        raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
      end if;
    end if;
  elsif tg_table_name = 'challenge_group_votes' then
    if r.state <> 'completed' or r.group_replay_until <= clock_timestamp() or (r.community and (r.community_phase <> 'voting' or not r.community_voting)) then
      raise exception using errcode = '55000', message = 'ROUND_VOTE_INVALID';
    end if;
    if not exists (select 1 from public.challenge_group_members where id = new.target_member_id
      and challenge_id = r.id and submitted_take_id is not null
      and (not r.community or showcased)) then
      raise exception using errcode = '22023', message = 'ROUND_VOTE_INVALID';
    end if;
  end if;
  return new;
end;
$$;
create or replace function public.create_group_round(
  p_owner_user uuid, p_guest_hash text, p_token_hash text, p_name text,
  p_assignment jsonb, p_closes_at timestamptz, p_previous_id uuid,
  p_request_id uuid, p_host_name text, p_community boolean default false, p_limit integer default 25, p_voting boolean default true, p_display_hash text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.challenges; m public.challenge_group_members; v_mode text := p_assignment->>'mode';
  v_now timestamptz := clock_timestamp(); v_id uuid := gen_random_uuid();
  v_request_hash text := encode(extensions.digest(convert_to(p_request_id::text,'UTF8'),'sha256'),'hex');
begin
  if (p_owner_user is null and p_guest_hash is null) or p_request_id is null then
    raise exception using errcode = '22023', message = 'ROUND_FORBIDDEN';
  end if;
  if not public.lock_users_for_account_mutation(array[p_owner_user]) then
    raise exception using errcode = '55000', message = 'ROUND_FORBIDDEN';
  end if;
  if p_previous_id is not null then
    perform 1 from public.challenges where id = p_previous_id for update;
    if exists(select 1 from public.challenges where id = p_previous_id and community and community_next_id is not null
      and community_next_id <> coalesce((select id from public.challenges where group_request_hash = v_request_hash),gen_random_uuid())) then
      raise exception 'ROUND_NEXT_EXISTS';
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('delivery-group-create:' || p_request_id::text, 0));
  select * into r from public.challenges where group_request_hash = v_request_hash for update;
  if found then
    select * into m from public.challenge_group_members where id = r.group_host_member_id;
    if r.group_mode is null or r.group_assignment is distinct from p_assignment
      or r.group_name is distinct from btrim(p_name) or r.group_token_hash is distinct from p_token_hash
      or r.community is distinct from p_community or r.community_limit is distinct from p_limit or r.community_voting is distinct from p_voting
      or r.group_previous_id is distinct from p_previous_id
      or not coalesce((p_owner_user is not null and m.user_id = p_owner_user)
        or (m.user_id is null and m.guest_owner_hash = p_guest_hash), false) then
      raise exception using errcode = '23505', message = 'ROUND_IDEMPOTENCY_CONFLICT';
    end if;
    return to_jsonb(r);
  end if;
  if v_mode is null or v_mode not in ('classic','say-it-back','switch')
    or p_closes_at <= v_now or p_closes_at > v_now + interval '7 days'
    or p_assignment->>'scoringVersion' is null
    or (v_mode in ('classic','switch') and p_assignment->>'rubricVersion' is null) then
    raise exception using errcode = '22023', message = 'ROUND_ASSIGNMENT_INVALID';
  end if;
  if p_previous_id is not null and not exists (
    select 1 from public.challenge_group_members m2 join public.challenges c on c.id = m2.challenge_id
    where c.id = p_previous_id and c.group_mode is not null and c.state = 'completed'
      and (not c.community or (c.community_phase = 'results' and m2.id = c.group_host_member_id and p_community))
      and ((p_owner_user is not null and m2.user_id = p_owner_user)
        or (m2.user_id is null and m2.guest_owner_hash = p_guest_hash))
  ) then
    raise exception using errcode = '42501', message = 'ROUND_FORBIDDEN';
  end if;
  insert into public.challenges(id,code,created_by,prompt_id,energy_modifier_id,max_entries,
    group_mode,group_assignment,group_name,group_token_hash,group_request_hash,group_closes_at,
    group_replay_until,group_previous_id,expires_at,created_at,community,community_limit,community_voting,community_code,display_token_hash)
  values(v_id, left(replace(v_id::text,'-',''),20), null,
    case when v_mode = 'classic' then (p_assignment->>'promptId')::uuid else null end,
    nullif(p_assignment->>'energyId','')::uuid,12,
    v_mode,p_assignment,btrim(p_name),p_token_hash,v_request_hash,p_closes_at,
    v_now + interval '14 days',p_previous_id,v_now + interval '14 days',v_now,p_community,p_limit,p_voting,case when p_community then upper(left(replace(v_id::text,'-',''),8)) end,case when p_community then p_display_hash end)
  returning * into r;
  insert into public.challenge_group_members(challenge_id,user_id,guest_owner_hash,display_name)
  values(r.id,p_owner_user,case when p_owner_user is null then p_guest_hash else null end,btrim(p_host_name))
  returning * into m;
  update public.challenges set group_host_member_id = m.id where id = r.id returning * into r;
  if p_previous_id is not null and p_community then
    update public.challenges set community_next_id = r.id where id = p_previous_id;
  end if;
  return to_jsonb(r);
end;
$$;

create or replace function public.group_round_action(
  p_challenge_id uuid, p_owner_user uuid, p_guest_hash text, p_action text, p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.challenges; m public.challenge_group_members; t public.challenge_group_takes;
  source public.say_attempts; switch_source public.switch_attempts; v_now timestamptz; v_target uuid;
begin
  if not public.lock_users_for_account_mutation(array[p_owner_user]) then
    raise exception using errcode = '55000', message = 'ROUND_FORBIDDEN';
  end if;
  select * into r from public.challenges where id = p_challenge_id and group_mode is not null for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROUND_NOT_FOUND'; end if;
  v_now := clock_timestamp();
  if r.state = 'open' and r.group_closes_at <= v_now then
    update public.challenges set state = 'completed', completed_at = group_closes_at,
      community_phase = case when community then 'review' else community_phase end,
      group_replay_until = least(group_closes_at + interval '7 days',created_at + interval '14 days'),
      expires_at = least(group_closes_at + interval '7 days',created_at + interval '14 days')
    where id = r.id returning * into r;
  end if;
  if p_action = 'refresh' then return to_jsonb(r); end if;
  select * into m from public.challenge_group_members where challenge_id = r.id
    and ((p_owner_user is not null and user_id = p_owner_user)
      or (user_id is null and guest_owner_hash = p_guest_hash))
    order by (user_id is not null) desc limit 1;
  if p_action = 'claim' then
    if p_owner_user is null or p_guest_hash is null then
      raise exception using errcode = '42501', message = 'ROUND_FORBIDDEN';
    end if;
    if m.id is not null and m.user_id is not null then
      if m.guest_owner_hash is distinct from p_guest_hash and exists (
        select 1 from public.challenge_group_members where challenge_id = r.id and guest_owner_hash = p_guest_hash
      ) then
        raise exception using errcode = '23505', message = 'ROUND_CLAIM_CONFLICT';
      end if;
      return to_jsonb(r);
    end if;
    update public.challenge_group_members set user_id = p_owner_user
      where challenge_id = r.id and guest_owner_hash = p_guest_hash and user_id is null returning * into m;
    if not found then raise exception using errcode = '42501', message = 'ROUND_CLAIM_CONFLICT'; end if;
    return to_jsonb(r);
  end if;
  if r.group_replay_until <= v_now then
    raise exception using errcode = '55000', message = 'ROUND_EXPIRED';
  end if;
  if p_action = 'join' then
    if m.id is not null then return to_jsonb(r); end if;
    if exists(select 1 from public.challenge_group_members where challenge_id = r.id and guest_owner_hash = p_guest_hash and user_id is not null) then raise exception 'ROUND_SIGN_IN_REQUIRED'; end if;
    if p_owner_user is null and p_guest_hash is null then
      raise exception using errcode = '42501', message = 'ROUND_FORBIDDEN';
    end if;
    insert into public.challenge_group_members(challenge_id,user_id,guest_owner_hash,display_name)
      values(r.id,p_owner_user,case when p_owner_user is null then p_guest_hash else null end,btrim(p_payload->>'displayName'));
    return to_jsonb(r);
  end if;
  if m.id is null then raise exception using errcode = '42501', message = 'ROUND_NOT_MEMBER'; end if;
  if r.community and p_action in ('select','hide','showcase','start-voting','end-voting','display','revoke-display') then
    if m.id is distinct from r.group_host_member_id then raise exception 'ROUND_FORBIDDEN'; end if;
    if p_action in ('select','hide') then
      if p_action = 'select' and r.community_phase not in ('submissions','review') then raise exception 'ROUND_ACTION_INVALID'; end if;
      v_target := (p_payload->>'memberId')::uuid;
      if p_action = 'select' then
        if not exists(select 1 from public.challenge_group_members cm join public.challenge_group_takes ct on ct.id = cm.submitted_take_id
          where cm.id = v_target and cm.challenge_id = r.id and ct.broadcast_consent_at is not null
          and ct.moderation_state in ('approved','unreviewed') and ct.expires_at > v_now) then raise exception 'ROUND_TAKE_INVALID'; end if;
        if (select count(*) from public.challenge_group_members where challenge_id = r.id and showcased and id <> v_target) >= 12 then raise exception 'ROUND_SHOWCASE_FULL'; end if;
      end if;
      update public.challenge_group_members set showcased = (p_action = 'select') where id = v_target and challenge_id = r.id;
      if p_action = 'hide' then
        delete from public.challenge_group_votes where challenge_id = r.id and target_member_id = v_target;
        update public.challenges set display_member_id = case when display_member_id = v_target then null else display_member_id end,
          display_command = 'pause', display_revision = display_revision + 1 where id = r.id returning * into r;
      end if;
    elsif p_action = 'showcase' then
      if r.community_phase = 'showcase' then return to_jsonb(r); end if;
      if r.community_phase <> 'review' then raise exception 'ROUND_ACTION_INVALID'; end if;
      update public.challenges set community_phase = 'showcase' where id = r.id returning * into r;
    elsif p_action = 'start-voting' then
      if r.community_phase = 'voting' then return to_jsonb(r); end if;
      if r.community_phase <> 'showcase' or not r.community_voting then raise exception 'ROUND_ACTION_INVALID'; end if;
      update public.challenges set community_phase = 'voting', display_command = 'pause', display_revision = display_revision + 1 where id = r.id returning * into r;
    elsif p_action = 'end-voting' then
      if r.community_phase = 'results' then return to_jsonb(r); end if;
      if r.community_phase not in ('showcase','voting','review') then raise exception 'ROUND_ACTION_INVALID'; end if;
      update public.challenges set community_phase = 'results', display_command = 'pause', display_revision = display_revision + 1 where id = r.id returning * into r;
    elsif p_action = 'revoke-display' then
      update public.challenges set display_revoked_at = coalesce(display_revoked_at,v_now) where id = r.id returning * into r;
    elsif p_action = 'display' then
      if r.community_phase <> 'showcase' then raise exception 'ROUND_ACTION_INVALID'; end if;
      -- Compare-and-set prevents duplicated play/skip commands on HTTP retries.
      if (p_payload->>'revision')::integer <> r.display_revision then return to_jsonb(r); end if;
      v_target := (p_payload->>'memberId')::uuid;
      if not exists(select 1 from public.challenge_group_members where id = v_target and challenge_id = r.id and showcased and submitted_take_id is not null) then raise exception 'ROUND_TAKE_INVALID'; end if;
      update public.challenges set display_member_id = v_target, display_command = p_payload->>'command', display_revision = display_revision + 1 where id = r.id returning * into r;
    end if;
    return to_jsonb(r);
  elsif p_action = 'close' then
    if m.id is distinct from r.group_host_member_id then raise exception using errcode = '42501', message = 'ROUND_FORBIDDEN'; end if;
    if r.state = 'open' then
      update public.challenges set state = 'completed',completed_at = v_now,
        community_phase = case when community then 'review' else community_phase end,
        group_replay_until = least(v_now + interval '7 days',created_at + interval '14 days'),
        expires_at = least(v_now + interval '7 days',created_at + interval '14 days')
      where id = r.id returning * into r;
    end if;
  elsif p_action = 'revoke' then
    if m.id is distinct from r.group_host_member_id then raise exception using errcode = '42501', message = 'ROUND_FORBIDDEN'; end if;
    update public.challenges set group_invite_revoked_at = coalesce(group_invite_revoked_at,v_now)
      where id = r.id returning * into r;
  elsif p_action = 'submit' then
    -- Lost HTTP response may be retried after closure; it must acknowledge the
    -- already chosen performance without admitting a different replacement.
    if r.community and (p_payload->>'broadcastConsent') is distinct from 'true' then raise exception 'ROUND_BROADCAST_CONSENT'; end if;
    if m.submitted_take_id = (p_payload->>'takeId')::uuid then return to_jsonb(r); end if;
    if r.state <> 'open' then raise exception using errcode = '55000', message = 'ROUND_CLOSED'; end if;
    if r.community and m.submitted_take_id is null and (select count(*) from public.challenge_group_members where challenge_id = r.id and submitted_take_id is not null) >= r.community_limit then raise exception 'ROUND_FULL'; end if;
    select * into t from public.challenge_group_takes
      where id = (p_payload->>'takeId')::uuid and member_id = m.id and challenge_id = r.id for update;
    if not found or t.mode <> r.group_mode or t.scoring_version <> r.group_assignment->>'scoringVersion'
      or t.moderation_state not in ('approved','unreviewed') or t.expires_at <= v_now then
      raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
    end if;
    if t.submitted_at is not null then
      raise exception using errcode = '23505', message = 'ROUND_TAKE_SUPERSEDED';
    end if;
    if t.mode = 'say-it-back' then
      select * into source from public.say_attempts where id = t.say_attempt_id for update;
      if not found or source.moderation_state in ('rejected','review')
        or (source.status = 'scored' and source.moderation_state <> 'approved')
        or (source.score is not null and source.moderation_state <> 'approved')
        or (t.moderation_state = 'unreviewed' and source.status not in ('ready','failed'))
        or source.clip_version_id is distinct from ((r.group_assignment->'clip'->>'id') || ':' || (r.group_assignment->'clip'->>'version'))
        or source.role_id <> r.group_assignment->>'roleId'
        or source.scoring_version <> t.scoring_version
        or (source.expires_at is not null and source.expires_at <= v_now)
        or not coalesce((m.user_id is not null and source.user_id = m.user_id)
          or (source.user_id is null and source.guest_owner_hash = m.guest_owner_hash),false) then
        raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
      end if;
      if source.user_id is null then
        update public.say_attempts set expires_at = greatest(expires_at,r.group_replay_until) where id = source.id;
      end if;
    end if;
    if t.mode = 'switch' then
      select * into switch_source from public.switch_attempts where id = t.switch_attempt_id for update;
      if not found or switch_source.moderation_state in ('rejected','review')
        or (switch_source.status = 'scored' and switch_source.moderation_state <> 'approved')
        or (switch_source.score is not null and switch_source.moderation_state <> 'approved')
        or (t.moderation_state = 'unreviewed' and switch_source.status not in ('ready','failed'))
        or switch_source.challenge_snapshot is distinct from (r.group_assignment->'challenge')
        or switch_source.challenge_version_id is distinct from ((r.group_assignment->'challenge'->>'id') || ':' || (r.group_assignment->'challenge'->>'version'))
        or switch_source.scoring_version <> t.scoring_version
        or (switch_source.expires_at is not null and switch_source.expires_at <= v_now)
        or not coalesce((m.user_id is not null and switch_source.user_id = m.user_id)
          or (switch_source.user_id is null and switch_source.guest_owner_hash = m.guest_owner_hash),false) then
        raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
      end if;
      if switch_source.user_id is null then
        update public.switch_attempts set expires_at = greatest(expires_at,r.group_replay_until) where id = switch_source.id;
      end if;
    end if;
    update public.challenge_group_takes set submitted_at = coalesce(submitted_at,v_now),
      broadcast_consent_at = case when r.community then v_now else null end,
      expires_at = greatest(expires_at,r.group_replay_until) where id = t.id;
    update public.challenge_group_members set submitted_take_id = t.id, showcased = false where id = m.id;
  elsif p_action = 'vote' then
    v_target := (p_payload->>'targetMemberId')::uuid;
    if v_target is null or v_target = m.id then
      raise exception using errcode = '22023', message = 'ROUND_VOTE_INVALID';
    end if;
    insert into public.challenge_group_votes(challenge_id,voter_member_id,target_member_id)
      values(r.id,m.id,v_target) on conflict(challenge_id,voter_member_id)
      do update set target_member_id = excluded.target_member_id;
  else
    raise exception using errcode = '22023', message = 'ROUND_ACTION_INVALID';
  end if;
  return to_jsonb(r);
end;
$$;

-- Keep RPCs restricted to the existing application service. No new public API grants.
revoke all on function public.guard_group_child(),
  public.create_group_round(uuid,text,text,text,jsonb,timestamptz,uuid,uuid,text,boolean,integer,boolean,text),
  public.group_round_action(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.guard_group_child(),
  public.create_group_round(uuid,text,text,text,jsonb,timestamptz,uuid,uuid,text,boolean,integer,boolean,text),
  public.group_round_action(uuid,uuid,text,text,jsonb) to service_role;
comment on column public.challenge_group_takes.switch_attempt_id is 'Private immutable Switch source; deletion leaves an unavailable receipt. No ranked leaderboard entry.';
