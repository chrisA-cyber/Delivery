-- Group rounds extend challenges. Existing 1:1 receipts and their RLS remain
-- intact; only the application service may access the new capability boundary.
alter table public.challenges
  alter column created_by drop not null,
  alter column prompt_id drop not null,
  add column group_mode text check (group_mode in ('classic', 'say-it-back')),
  add column group_assignment jsonb,
  add column group_name text,
  add column group_token_hash text unique,
  add column group_request_hash text unique,
  add column group_host_member_id uuid,
  add column group_closes_at timestamptz,
  add column group_replay_until timestamptz,
  add column group_invite_revoked_at timestamptz,
  add column group_previous_id uuid references public.challenges(id) on delete set null,
  add constraint challenges_legacy_or_group check (
    (group_mode is null and created_by is not null and prompt_id is not null
      and group_assignment is null and group_token_hash is null and group_request_hash is null)
    or
    (group_mode is not null and created_by is null and token_digest is null
      and recipient_user_id is null and visibility = 'link' and max_entries = 12
      and group_assignment is not null and jsonb_typeof(group_assignment) = 'object'
      and (group_assignment->>'mode' = group_mode) is true
      and (length(group_assignment->>'scoringVersion') between 1 and 80) is true
      and group_name is not null and length(btrim(group_name)) between 1 and 60
      and group_token_hash is not null and group_token_hash ~ '^[a-f0-9]{64}$'
      and group_request_hash is not null and group_request_hash ~ '^[a-f0-9]{64}$'
      and group_closes_at is not null and group_closes_at > created_at
      and group_closes_at <= created_at + interval '7 days'
      and group_replay_until is not null and group_replay_until > created_at
      and group_replay_until <= created_at + interval '14 days'
      and (group_mode <> 'classic' or (prompt_id is not null
        and (group_assignment->>'promptId' = prompt_id::text) is true
        and (length(group_assignment->>'rubricVersion') between 1 and 80) is true))
      and (group_mode <> 'say-it-back' or ((length(group_assignment->'clip'->>'id') > 0) is true
        and (length(group_assignment->'clip'->>'version') > 0) is true
        and (length(group_assignment->>'roleId') > 0) is true)))
  );

create policy "legacy challenge clients cannot access group rounds"
  on public.challenges as restrictive for all to anon, authenticated
  using (group_mode is null) with check (group_mode is null);

create table public.challenge_group_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  guest_owner_hash text,
  display_name text not null check (length(btrim(display_name)) between 1 and 32),
  submitted_take_id uuid,
  joined_at timestamptz not null default now(),
  check (user_id is not null or guest_owner_hash is not null),
  check (guest_owner_hash is null or guest_owner_hash ~ '^[a-f0-9]{64}$'),
  unique(challenge_id, user_id),
  unique(challenge_id, guest_owner_hash),
  unique(challenge_id, id)
);

create table public.challenge_group_takes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  member_id uuid not null,
  attempt_key text not null check (attempt_key ~ '^[A-Za-z0-9:_.-]{8,128}$'),
  request_fingerprint text not null check (length(request_fingerprint) between 1 and 128),
  mode text not null check (mode in ('classic', 'say-it-back')),
  say_attempt_id uuid references public.say_attempts(id) on delete set null,
  recording_path text unique,
  audio_mime text,
  audio_hash text,
  duration_ms integer check (duration_ms between 250 and 30000),
  score jsonb,
  scoring_version text not null check (length(scoring_version) between 1 and 80),
  moderation_state text not null default 'unreviewed' check (moderation_state in ('unreviewed','pending','approved','rejected','review')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key(challenge_id, member_id) references public.challenge_group_members(challenge_id, id) on delete cascade,
  unique(member_id, attempt_key),
  unique(member_id, id),
  -- A deleted Say source leaves an unavailable receipt, never a public fallback.
  check ((mode = 'say-it-back' and recording_path is null)
    or (mode = 'classic' and say_attempt_id is null and recording_path is not null
      and audio_mime is not null and audio_hash is not null and duration_ms is not null and duration_ms <= 20000)),
  check (score is null or jsonb_typeof(score) = 'object'),
  check (moderation_state <> 'unreviewed' or score is null)
);
alter table public.challenge_group_members add constraint group_member_current_take_fk
  foreign key(submitted_take_id) references public.challenge_group_takes(id) on delete set null;
alter table public.challenges add constraint group_host_member_fk
  foreign key(group_host_member_id) references public.challenge_group_members(id) on delete set null
  deferrable initially deferred;

create table public.challenge_group_votes (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  voter_member_id uuid not null,
  target_member_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(challenge_id, voter_member_id),
  foreign key(challenge_id, voter_member_id) references public.challenge_group_members(challenge_id, id) on delete cascade,
  foreign key(challenge_id, target_member_id) references public.challenge_group_members(challenge_id, id) on delete cascade,
  check (voter_member_id <> target_member_id)
);

create index challenge_groups_expiry on public.challenges(group_replay_until) where group_mode is not null;
create index challenge_groups_previous on public.challenges(group_previous_id) where group_previous_id is not null;
create index challenge_groups_host on public.challenges(group_host_member_id) where group_host_member_id is not null;
create index challenge_group_members_user on public.challenge_group_members(user_id) where user_id is not null;
create index challenge_group_members_take on public.challenge_group_members(submitted_take_id) where submitted_take_id is not null;
create index challenge_group_takes_expiry on public.challenge_group_takes(expires_at);
create index challenge_group_takes_round on public.challenge_group_takes(challenge_id);
create index challenge_group_takes_say on public.challenge_group_takes(say_attempt_id) where say_attempt_id is not null;
create index challenge_group_votes_target on public.challenge_group_votes(challenge_id, target_member_id);

alter table public.challenge_group_members enable row level security;
alter table public.challenge_group_takes enable row level security;
alter table public.challenge_group_votes enable row level security;
revoke all on public.challenge_group_members, public.challenge_group_takes, public.challenge_group_votes from public, anon, authenticated;
grant all on public.challenge_group_members, public.challenge_group_takes, public.challenge_group_votes to service_role;
-- Do not rely on the project's historical default table privileges.
grant select, insert, update, delete on public.challenges to service_role;

create function public.guard_group_assignment() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.group_mode is distinct from old.group_mode
    or (old.group_mode is not null and (
      new.group_assignment is distinct from old.group_assignment
      or new.group_token_hash is distinct from old.group_token_hash
      or new.group_request_hash is distinct from old.group_request_hash
      or new.group_name is distinct from old.group_name
      or new.group_closes_at is distinct from old.group_closes_at
      or new.prompt_id is distinct from old.prompt_id
      or new.energy_modifier_id is distinct from old.energy_modifier_id
      or new.created_at is distinct from old.created_at
      or (new.group_previous_id is distinct from old.group_previous_id and new.group_previous_id is not null)
    )) then
    raise exception using errcode = '22023', message = 'ROUND_ASSIGNMENT_IMMUTABLE';
  end if;
  if new.group_mode is not null and new.group_host_member_id is not null
    and not exists (select 1 from public.challenge_group_members m
      where m.id = new.group_host_member_id and m.challenge_id = new.id) then
    raise exception using errcode = '22023', message = 'ROUND_FORBIDDEN';
  end if;
  return new;
end;
$$;
create trigger challenges_group_assignment_immutable before update on public.challenges
  for each row execute function public.guard_group_assignment();

create function public.guard_group_child() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare r public.challenges; m public.challenge_group_members; source public.say_attempts;
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
    if tg_op = 'INSERT' and (r.state <> 'open' or r.group_closes_at <= clock_timestamp()) then
      raise exception using errcode = '55000', message = 'ROUND_CLOSED';
    end if;
    if tg_op = 'INSERT' and r.group_invite_revoked_at is not null then
      raise exception using errcode = '55000', message = 'ROUND_INVITE_REVOKED';
    end if;
    if tg_op = 'INSERT' and (select count(*) from public.challenge_group_members where challenge_id = r.id) >= 12 then
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
      or (new.say_attempt_id is distinct from old.say_attempt_id and new.say_attempt_id is not null)) then
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
  elsif tg_table_name = 'challenge_group_votes' then
    if r.state <> 'completed' or r.group_replay_until <= clock_timestamp() then
      raise exception using errcode = '55000', message = 'ROUND_VOTE_INVALID';
    end if;
    if not exists (select 1 from public.challenge_group_members where id = new.target_member_id
      and challenge_id = r.id and submitted_take_id is not null) then
      raise exception using errcode = '22023', message = 'ROUND_VOTE_INVALID';
    end if;
  end if;
  return new;
end;
$$;
create trigger group_member_guard before insert or update on public.challenge_group_members
  for each row execute function public.guard_group_child();
create trigger group_take_guard before insert or update on public.challenge_group_takes
  for each row execute function public.guard_group_child();
create trigger group_vote_guard before insert or update on public.challenge_group_votes
  for each row execute function public.guard_group_child();

-- Prevent legacy entry APIs, including SECURITY DEFINER helpers, from admitting
-- a delivery into a group by guessing its UUID.
create function public.guard_legacy_group_entry() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.challenges where id = new.challenge_id and group_mode is not null) then
    raise exception using errcode = '22023', message = 'ROUND_TAKE_INVALID';
  end if;
  return new;
end;
$$;
create trigger a_group_entries_use_group_api before insert or update on public.challenge_entries
  for each row execute function public.guard_legacy_group_entry();
create trigger a_group_deliveries_use_group_api before insert or update of challenge_id on public.deliveries
  for each row execute function public.guard_legacy_group_entry();

create function public.create_group_round(
  p_owner_user uuid, p_guest_hash text, p_token_hash text, p_name text,
  p_assignment jsonb, p_closes_at timestamptz, p_previous_id uuid,
  p_request_id uuid, p_host_name text
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
  perform pg_advisory_xact_lock(hashtextextended('delivery-group-create:' || p_request_id::text, 0));
  select * into r from public.challenges where group_request_hash = v_request_hash for update;
  if found then
    select * into m from public.challenge_group_members where id = r.group_host_member_id;
    if r.group_mode is null or r.group_assignment is distinct from p_assignment
      or r.group_name is distinct from btrim(p_name) or r.group_token_hash is distinct from p_token_hash
      or r.group_previous_id is distinct from p_previous_id
      or not coalesce((p_owner_user is not null and m.user_id = p_owner_user)
        or (m.user_id is null and m.guest_owner_hash = p_guest_hash), false) then
      raise exception using errcode = '23505', message = 'ROUND_IDEMPOTENCY_CONFLICT';
    end if;
    return to_jsonb(r);
  end if;
  if v_mode is null or v_mode not in ('classic','say-it-back')
    or p_closes_at <= v_now or p_closes_at > v_now + interval '7 days'
    or p_assignment->>'scoringVersion' is null
    or (v_mode = 'classic' and p_assignment->>'rubricVersion' is null) then
    raise exception using errcode = '22023', message = 'ROUND_ASSIGNMENT_INVALID';
  end if;
  if p_previous_id is not null and not exists (
    select 1 from public.challenge_group_members m2 join public.challenges c on c.id = m2.challenge_id
    where c.id = p_previous_id and c.group_mode is not null and c.state = 'completed'
      and ((p_owner_user is not null and m2.user_id = p_owner_user)
        or (m2.user_id is null and m2.guest_owner_hash = p_guest_hash))
  ) then
    raise exception using errcode = '42501', message = 'ROUND_FORBIDDEN';
  end if;
  insert into public.challenges(id,code,created_by,prompt_id,energy_modifier_id,max_entries,
    group_mode,group_assignment,group_name,group_token_hash,group_request_hash,group_closes_at,
    group_replay_until,group_previous_id,expires_at,created_at)
  values(v_id, left(replace(v_id::text,'-',''),20), null,
    case when v_mode = 'classic' then (p_assignment->>'promptId')::uuid else null end,
    nullif(p_assignment->>'energyId','')::uuid,12,
    v_mode,p_assignment,btrim(p_name),p_token_hash,v_request_hash,p_closes_at,
    v_now + interval '14 days',p_previous_id,v_now + interval '14 days',v_now)
  returning * into r;
  insert into public.challenge_group_members(challenge_id,user_id,guest_owner_hash,display_name)
  values(r.id,p_owner_user,case when p_owner_user is null then p_guest_hash else null end,btrim(p_host_name))
  returning * into m;
  update public.challenges set group_host_member_id = m.id where id = r.id returning * into r;
  return to_jsonb(r);
end;
$$;

create function public.group_round_action(
  p_challenge_id uuid, p_owner_user uuid, p_guest_hash text, p_action text, p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.challenges; m public.challenge_group_members; t public.challenge_group_takes;
  source public.say_attempts; v_now timestamptz; v_target uuid;
begin
  if not public.lock_users_for_account_mutation(array[p_owner_user]) then
    raise exception using errcode = '55000', message = 'ROUND_FORBIDDEN';
  end if;
  select * into r from public.challenges where id = p_challenge_id and group_mode is not null for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROUND_NOT_FOUND'; end if;
  v_now := clock_timestamp();
  if r.state = 'open' and r.group_closes_at <= v_now then
    update public.challenges set state = 'completed', completed_at = group_closes_at,
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
    if p_owner_user is null and p_guest_hash is null then
      raise exception using errcode = '42501', message = 'ROUND_FORBIDDEN';
    end if;
    insert into public.challenge_group_members(challenge_id,user_id,guest_owner_hash,display_name)
      values(r.id,p_owner_user,case when p_owner_user is null then p_guest_hash else null end,btrim(p_payload->>'displayName'));
    return to_jsonb(r);
  end if;
  if m.id is null then raise exception using errcode = '42501', message = 'ROUND_NOT_MEMBER'; end if;
  if p_action = 'close' then
    if m.id is distinct from r.group_host_member_id then raise exception using errcode = '42501', message = 'ROUND_FORBIDDEN'; end if;
    if r.state = 'open' then
      update public.challenges set state = 'completed',completed_at = v_now,
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
    if m.submitted_take_id = (p_payload->>'takeId')::uuid then return to_jsonb(r); end if;
    if r.state <> 'open' then raise exception using errcode = '55000', message = 'ROUND_CLOSED'; end if;
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
    update public.challenge_group_takes set submitted_at = coalesce(submitted_at,v_now),
      expires_at = greatest(expires_at,r.group_replay_until) where id = t.id;
    update public.challenge_group_members set submitted_take_id = t.id where id = m.id;
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

revoke all on function public.guard_group_assignment(), public.guard_group_child(), public.guard_legacy_group_entry() from public, anon, authenticated;
revoke all on function public.create_group_round(uuid,text,text,text,jsonb,timestamptz,uuid,uuid,text),
  public.group_round_action(uuid,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_group_round(uuid,text,text,text,jsonb,timestamptz,uuid,uuid,text),
  public.group_round_action(uuid,uuid,text,text,jsonb) to service_role;

comment on column public.challenges.group_assignment is 'Immutable shared scene/role or Classic prompt, content rating, and scoring version. Group APIs enforce content admission before returning it.';
comment on table public.challenge_group_members is 'One participant per verified account or original guest capability per round; claiming does not merge separate memberships.';
comment on table public.challenge_group_takes is 'Private candidates; only the member current submitted_take_id is revealed after closure. Guest retention is bounded to fourteen days from round creation.';
