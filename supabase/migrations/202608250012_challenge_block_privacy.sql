-- Blocking is a hard challenge privacy boundary. It revokes signed receipts,
-- cancels active matchups, and closes participant/public RLS side channels.

-- Every writer that can race account deletion takes the same per-user lock used
-- by begin_account_deletion(). Sorting the UUIDs gives multi-user interactions a
-- deterministic lock order and prevents cross-user deadlocks.
create or replace function public.lock_users_for_account_mutation(p_user_ids uuid[])
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  for target_user_id in
    select distinct candidate.user_id
    from pg_catalog.unnest(coalesce(p_user_ids, '{}'::uuid[])) as candidate(user_id)
    where candidate.user_id is not null
    order by candidate.user_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'delivery-account-delete:' || target_user_id::text,
        0
      )
    );
  end loop;

  return not exists (
    select 1
    from public.account_deletion_jobs j
    where j.user_id = any(coalesce(p_user_ids, '{}'::uuid[]))
  );
end;
$$;

create or replace function public.lock_interaction_pair(
  p_first_user_id uuid,
  p_second_user_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  first_key text;
  second_key text;
begin
  if p_first_user_id is null
     or p_second_user_id is null
     or p_first_user_id = p_second_user_id then
    return;
  end if;

  first_key := least(p_first_user_id::text, p_second_user_id::text);
  second_key := greatest(p_first_user_id::text, p_second_user_id::text);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'delivery-interaction:' || first_key || ':' || second_key,
      0
    )
  );
end;
$$;

create or replace function public.interaction_is_blocked(
  p_first_user_id uuid,
  p_second_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_first_user_id is not null
    and p_second_user_id is not null
    and exists (
      select 1
      from public.blocks b
      where (b.blocker_id = p_first_user_id and b.blocked_id = p_second_user_id)
         or (b.blocker_id = p_second_user_id and b.blocked_id = p_first_user_id)
    );
$$;

-- Replace the 008 invariant with deletion-aware containment. The shared advisory
-- lock closes account-PATCH/begin-deletion TOCTOU in both commit orders.
create or replace function public.enforce_profile_moderation_containment()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account_is_active boolean;
  has_profile_limit boolean;
  has_profile_remove boolean;
begin
  account_is_active := public.lock_users_for_account_mutation(array[new.id]);

  if not account_is_active then
    new.is_private := true;
    new.display_name := 'Player';
    new.bio := null;
    new.avatar_path := null;
    return new;
  end if;

  select
    coalesce(pg_catalog.bool_or(r.kind = 'profile-limit'), false),
    coalesce(pg_catalog.bool_or(r.kind = 'profile-remove'), false)
  into has_profile_limit, has_profile_remove
  from public.account_restrictions r
  where r.user_id = new.id
    and r.starts_at <= now()
    and (r.ends_at is null or r.ends_at > now())
    and r.kind in ('profile-limit', 'profile-remove');

  if has_profile_remove then
    new.is_private := true;
    new.display_name := 'Player';
    new.bio := null;
    new.avatar_path := null;
  elsif has_profile_limit then
    new.is_private := true;
  end if;

  return new;
end;
$$;

create or replace function public.guard_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_is_private boolean;
begin
  if not public.lock_users_for_account_mutation(
    array[new.follower_id, new.following_id]
  ) then
    raise exception using errcode = '55000', message = 'Account deletion is already in progress';
  end if;
  perform public.lock_interaction_pair(new.follower_id, new.following_id);
  if public.interaction_is_blocked(new.follower_id, new.following_id) then
    raise exception using errcode = '55000', message = 'Interaction is unavailable between blocked users';
  end if;

  select p.is_private into target_is_private
  from public.profiles p
  where p.id = new.following_id
  for key share;

  if not found
     or public.has_active_restriction(new.following_id, 'profile-limit')
     or public.has_active_restriction(new.following_id, 'profile-remove') then
    raise exception using errcode = '55000', message = 'Profile is unavailable to follow';
  end if;

  -- INSERT/upsert is rejected even when an old edge still exists. This strict
  -- choice prevents an idempotent-looking stale upsert from recreating the row
  -- immediately after a concurrent privacy/moderation cleanup deletes it.
  if target_is_private then
    raise exception using errcode = '55000', message = 'Private profile is not accepting new followers';
  end if;
  return new;
end;
$$;

create or replace function public.guard_block_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.lock_users_for_account_mutation(
    array[new.blocker_id, new.blocked_id]
  ) then
    raise exception using errcode = '55000', message = 'Account deletion is already in progress';
  end if;
  perform public.lock_interaction_pair(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

create or replace function public.guard_reaction_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_owner_id uuid;
begin
  select d.user_id into delivery_owner_id
  from public.deliveries d
  where d.id = new.delivery_id;

  if delivery_owner_id is null then
    return new;
  end if;
  if not public.lock_users_for_account_mutation(
    array[new.user_id, delivery_owner_id]
  ) then
    raise exception using errcode = '55000', message = 'Account deletion is already in progress';
  end if;
  perform public.lock_interaction_pair(new.user_id, delivery_owner_id);
  if public.interaction_is_blocked(new.user_id, delivery_owner_id) then
    raise exception using errcode = '55000', message = 'Interaction is unavailable between blocked users';
  end if;
  if public.has_active_restriction(new.user_id, 'profile-limit')
     or public.has_active_restriction(new.user_id, 'profile-remove')
     or public.has_active_restriction(delivery_owner_id, 'profile-limit')
     or public.has_active_restriction(delivery_owner_id, 'profile-remove') then
    raise exception using errcode = '55000', message = 'Interaction is unavailable during profile containment';
  end if;
  return new;
end;
$$;

create or replace function public.guard_challenge_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.lock_users_for_account_mutation(
    array[new.created_by, new.recipient_user_id]
  ) then
    raise exception using errcode = '55000', message = 'Account deletion is already in progress';
  end if;

  if new.recipient_user_id is not null then
    perform public.lock_interaction_pair(new.created_by, new.recipient_user_id);
    if public.interaction_is_blocked(new.created_by, new.recipient_user_id) then
      raise exception using errcode = '55000', message = 'Interaction is unavailable between blocked users';
    end if;
  end if;
  if public.has_active_restriction(new.created_by, 'profile-limit')
     or public.has_active_restriction(new.created_by, 'profile-remove')
     or (
       new.recipient_user_id is not null
       and (
         public.has_active_restriction(new.recipient_user_id, 'profile-limit')
         or public.has_active_restriction(new.recipient_user_id, 'profile-remove')
       )
     ) then
    raise exception using errcode = '55000', message = 'Challenge is unavailable during profile containment';
  end if;
  return new;
end;
$$;

create or replace function public.guard_stream_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.lock_users_for_account_mutation(array[new.host_id]) then
    raise exception using errcode = '55000', message = 'Account deletion is already in progress';
  end if;
  return new;
end;
$$;

create or replace function public.guard_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.lock_users_for_account_mutation(array[new.submitted_by]) then
    raise exception using errcode = '55000', message = 'Account deletion is already in progress';
  end if;
  return new;
end;
$$;

drop trigger if exists follows_guard_interaction_insert on public.follows;
create trigger follows_guard_interaction_insert
  before insert on public.follows
  for each row execute function public.guard_follow_insert();

drop trigger if exists blocks_guard_interaction_insert on public.blocks;
create trigger blocks_guard_interaction_insert
  before insert on public.blocks
  for each row execute function public.guard_block_insert();

drop trigger if exists reactions_guard_interaction_insert on public.reactions;
create trigger reactions_guard_interaction_insert
  before insert on public.reactions
  for each row execute function public.guard_reaction_insert();

drop trigger if exists challenges_guard_account_insert on public.challenges;
create trigger challenges_guard_account_insert
  before insert on public.challenges
  for each row execute function public.guard_challenge_insert();

drop trigger if exists stream_sessions_guard_account_insert on public.stream_sessions;
create trigger stream_sessions_guard_account_insert
  before insert on public.stream_sessions
  for each row execute function public.guard_stream_insert();

drop trigger if exists line_submissions_guard_account_insert on public.line_submissions;
create trigger line_submissions_guard_account_insert
  before insert on public.line_submissions
  for each row execute function public.guard_submission_insert();

-- Durable profile containment is checked directly at read time. A stale follow
-- row can never reopen a limited/removed profile, even before cleanup commits or
-- after a future maintenance mistake recreates that edge.
create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and (
        p.id = (select auth.uid())
        or public.is_staff()
        or (
          not public.has_active_restriction(p.id, 'profile-limit')
          and not public.has_active_restriction(p.id, 'profile-remove')
          and not exists (
            select 1
            from public.blocks b
            where (b.blocker_id = p.id and b.blocked_id = (select auth.uid()))
               or (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id)
          )
          and (
            not p.is_private
            or exists (
              select 1
              from public.follows f
              where f.follower_id = (select auth.uid()) and f.following_id = p.id
            )
          )
        )
      )
  );
$$;

create or replace function public.can_view_challenge(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.challenges c
    where c.id = p_challenge_id
      and (
        public.is_staff()
        or (
          not public.has_active_restriction(c.created_by, 'profile-limit')
          and not public.has_active_restriction(c.created_by, 'profile-remove')
          and (
            c.recipient_user_id is null
            or (
              not public.has_active_restriction(c.recipient_user_id, 'profile-limit')
              and not public.has_active_restriction(c.recipient_user_id, 'profile-remove')
            )
          )
          and not exists (
            select 1
            from public.account_deletion_jobs j
            where j.user_id = c.created_by or j.user_id = c.recipient_user_id
          )
          and not exists (
            select 1
            from public.blocks b
            where (
                c.recipient_user_id is not null
                and (
                  (b.blocker_id = c.created_by and b.blocked_id = c.recipient_user_id)
                  or (b.blocker_id = c.recipient_user_id and b.blocked_id = c.created_by)
                )
              )
              or (
                (select auth.uid()) is not null
                and (
                  (b.blocker_id = (select auth.uid()) and b.blocked_id = c.created_by)
                  or (b.blocker_id = c.created_by and b.blocked_id = (select auth.uid()))
                  or (
                    c.recipient_user_id is not null
                    and (
                      (b.blocker_id = (select auth.uid()) and b.blocked_id = c.recipient_user_id)
                      or (b.blocker_id = c.recipient_user_id and b.blocked_id = (select auth.uid()))
                    )
                  )
                )
              )
          )
          and (
            c.created_by = (select auth.uid())
            or c.recipient_user_id = (select auth.uid())
            or c.visibility = 'public'
          )
        )
      )
  );
$$;

create or replace function public.get_challenge_by_invite(p_code text, p_token text)
returns table (
  id uuid,
  code text,
  created_by uuid,
  challenger_handle text,
  challenger_name text,
  challenger_avatar_path text,
  recipient_user_id uuid,
  prompt_id uuid,
  energy_modifier_id uuid,
  state public.challenge_state,
  visibility public.challenge_visibility,
  message text,
  max_entries smallint,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.code::text,
    c.created_by,
    p.handle::text,
    p.display_name,
    p.avatar_path,
    c.recipient_user_id,
    c.prompt_id,
    c.energy_modifier_id,
    c.state,
    c.visibility,
    c.message,
    c.max_entries,
    c.expires_at,
    c.created_at
  from public.challenges c
  join public.profiles p on p.id = c.created_by
  where pg_catalog.lower(c.code::text) = pg_catalog.lower(p_code)
    and c.token_digest is not null
    and c.token_digest = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and c.state in ('open', 'accepted', 'completed')
    and c.expires_at > now()
    and not exists (
      select 1
      from public.account_deletion_jobs j
      where j.user_id = c.created_by or j.user_id = c.recipient_user_id
    )
    and not public.has_active_restriction(c.created_by, 'profile-limit')
    and not public.has_active_restriction(c.created_by, 'profile-remove')
    and (
      c.recipient_user_id is null
      or (
        not public.has_active_restriction(c.recipient_user_id, 'profile-limit')
        and not public.has_active_restriction(c.recipient_user_id, 'profile-remove')
      )
    )
    and not exists (
      select 1
      from public.blocks b
      where (
          c.recipient_user_id is not null
          and (
            (b.blocker_id = c.created_by and b.blocked_id = c.recipient_user_id)
            or (b.blocker_id = c.recipient_user_id and b.blocked_id = c.created_by)
          )
        )
        or (
          (select auth.uid()) is not null
          and (
            (b.blocker_id = (select auth.uid()) and b.blocked_id = c.created_by)
            or (b.blocker_id = c.created_by and b.blocked_id = (select auth.uid()))
            or (
              c.recipient_user_id is not null
              and (
                (b.blocker_id = (select auth.uid()) and b.blocked_id = c.recipient_user_id)
                or (b.blocker_id = c.recipient_user_id and b.blocked_id = (select auth.uid()))
              )
            )
          )
        )
    )
  limit 1;
$$;

-- Participants need the opponent's minimal matchup identity even when that
-- profile is private. Keeping this as one gated projection avoids granting a
-- challenge side door to the profile, delivery, or score tables themselves.
create or replace function public.get_challenge_match_entries(
  p_challenge_id uuid
)
returns table (
  entrant_id uuid,
  handle text,
  display_name text,
  delivery_id uuid,
  created_at timestamptz,
  recording_path text,
  overall smallint,
  commitment smallint,
  comedy smallint,
  accuracy smallint,
  chaos smallint,
  headline text,
  verdict text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.entrant_id,
    p.handle::text,
    p.display_name,
    e.delivery_id,
    e.created_at,
    d.recording_path,
    s.overall,
    s.commitment,
    s.comedy,
    s.accuracy,
    s.chaos,
    s.headline,
    s.verdict
  from public.challenges c
  join public.challenge_entries e on e.challenge_id = c.id
  join public.deliveries d
    on d.id = e.delivery_id
   and d.challenge_id = c.id
   and d.user_id = e.entrant_id
  join public.delivery_scores s on s.delivery_id = d.id
  join public.profiles p on p.id = e.entrant_id
  join public.prompts pr on pr.id = d.prompt_id
  where c.id = p_challenge_id
    and (select auth.uid()) is not null
    and (
      c.created_by = (select auth.uid())
      or c.recipient_user_id = (select auth.uid())
    )
    and public.can_view_challenge(c.id)
    and public.can_view_delivery(d.id)
    and e.entrant_id in (c.created_by, c.recipient_user_id)
    and d.state = 'judged'
    and pr.state = 'published'
  order by e.created_at, e.delivery_id;
$$;

create or replace function public.validate_challenge_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.challenges;
  preliminary_creator_id uuid;
  preliminary_recipient_id uuid;
  delivery_owner uuid;
  delivery_challenge uuid;
  delivery_status public.delivery_state;
  entry_count integer;
begin
  select c.created_by, c.recipient_user_id
  into preliminary_creator_id, preliminary_recipient_id
  from public.challenges c
  where c.id = new.challenge_id;

  if not found then
    raise exception 'Challenge not found';
  end if;

  if not public.lock_users_for_account_mutation(
    array[preliminary_creator_id, preliminary_recipient_id, new.entrant_id]
  ) then
    raise exception 'Challenge is unavailable during account deletion';
  end if;
  perform public.lock_interaction_pair(preliminary_creator_id, new.entrant_id);

  select * into target
  from public.challenges
  where id = new.challenge_id
  for update;

  if not found then
    raise exception 'Challenge not found';
  end if;
  if target.state not in ('open', 'accepted') or target.expires_at <= now() then
    raise exception 'Challenge is no longer accepting entries';
  end if;

  if not public.lock_users_for_account_mutation(
    array[target.created_by, target.recipient_user_id, new.entrant_id]
  ) then
    raise exception 'Challenge is unavailable during account deletion';
  end if;
  perform public.lock_interaction_pair(target.created_by, new.entrant_id);

  if public.has_active_restriction(target.created_by, 'profile-limit')
     or public.has_active_restriction(target.created_by, 'profile-remove')
     or public.has_active_restriction(new.entrant_id, 'profile-limit')
     or public.has_active_restriction(new.entrant_id, 'profile-remove')
     or (
       target.recipient_user_id is not null
       and (
         public.has_active_restriction(target.recipient_user_id, 'profile-limit')
         or public.has_active_restriction(target.recipient_user_id, 'profile-remove')
       )
     ) then
    raise exception 'Challenge is unavailable during profile containment';
  end if;

  if public.interaction_is_blocked(target.created_by, new.entrant_id)
     or public.interaction_is_blocked(target.created_by, target.recipient_user_id) then
    raise exception 'Challenge is unavailable between blocked users';
  end if;

  select user_id, challenge_id, state
  into delivery_owner, delivery_challenge, delivery_status
  from public.deliveries
  where id = new.delivery_id;

  if delivery_owner is distinct from new.entrant_id
     or delivery_challenge is distinct from new.challenge_id then
    raise exception 'Delivery does not belong to this entrant and challenge';
  end if;
  if delivery_status is distinct from 'judged'
     or not exists (
       select 1 from public.delivery_scores s where s.delivery_id = new.delivery_id
     ) then
    raise exception 'Only judged deliveries can enter a challenge';
  end if;

  select count(*) into entry_count
  from public.challenge_entries
  where challenge_id = new.challenge_id;
  if entry_count >= target.max_entries then
    raise exception 'Challenge entry limit reached';
  end if;

  if new.entrant_id <> target.created_by then
    if target.recipient_user_id is null then
      update public.challenges
      set recipient_user_id = new.entrant_id,
          updated_at = now()
      where id = target.id and recipient_user_id is null;
      target.recipient_user_id := new.entrant_id;
    elsif target.recipient_user_id <> new.entrant_id then
      raise exception 'Entrant is not invited to this challenge';
    end if;
  end if;

  if target.recipient_user_id is not null
     and new.entrant_id not in (target.created_by, target.recipient_user_id) then
    raise exception 'Entrant is not invited to this challenge';
  end if;

  return new;
end;
$$;

-- Extend the existing block trigger rather than adding a second trigger. The
-- token digest is destroyed for every bound matchup, so unblock cannot resurrect
-- either an active invite or an old completed receipt.
create or replace function public.remove_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);

  delete from public.reactions r
  using public.deliveries d
  where d.id = r.delivery_id
    and (
      (r.user_id = new.blocker_id and d.user_id = new.blocked_id)
      or (r.user_id = new.blocked_id and d.user_id = new.blocker_id)
    );

  update public.challenges c
  set state = case
        when c.state in ('open', 'accepted') then 'canceled'::public.challenge_state
        else c.state
      end,
      visibility = 'private',
      token_digest = null,
      message = null,
      expires_at = case
        when c.state in ('open', 'accepted') then least(c.expires_at, now())
        else c.expires_at
      end,
      completed_at = case
        when c.state in ('open', 'accepted') then null
        else c.completed_at
      end,
      updated_at = now()
  where (
      c.created_by = new.blocker_id and c.recipient_user_id = new.blocked_id
    ) or (
      c.created_by = new.blocked_id and c.recipient_user_id = new.blocker_id
    );

  return new;
end;
$$;

-- Apply the same non-resurrection boundary to pairs that were already blocked
-- before this migration was installed.
update public.challenges c
set state = case
      when c.state in ('open', 'accepted') then 'canceled'::public.challenge_state
      else c.state
    end,
    visibility = 'private',
    token_digest = null,
    message = null,
    expires_at = case
      when c.state in ('open', 'accepted') then least(c.expires_at, now())
      else c.expires_at
    end,
    completed_at = case
      when c.state in ('open', 'accepted') then null
      else c.completed_at
    end,
    updated_at = now()
from public.blocks b
where (c.created_by = b.blocker_id and c.recipient_user_id = b.blocked_id)
   or (c.created_by = b.blocked_id and c.recipient_user_id = b.blocker_id);

drop policy if exists "challenge participants can read" on public.challenges;
create policy "challenge participants can read" on public.challenges
  for select using (public.can_view_challenge(id));

drop policy if exists "challenge entries visible to participants" on public.challenge_entries;
create policy "challenge entries visible to participants" on public.challenge_entries
  for select using (public.can_view_challenge(challenge_id));

revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to anon, authenticated;
revoke all on function public.can_view_challenge(uuid) from public;
grant execute on function public.can_view_challenge(uuid) to anon, authenticated;
revoke all on function public.get_challenge_by_invite(text, text) from public, anon, authenticated;
grant execute on function public.get_challenge_by_invite(text, text) to anon, authenticated;
revoke all on function public.get_challenge_match_entries(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_challenge_match_entries(uuid)
  to authenticated;
revoke all on function public.validate_challenge_entry()
  from public, anon, authenticated, service_role;
revoke all on function public.remove_follows_on_block()
  from public, anon, authenticated, service_role;
revoke all on function public.lock_users_for_account_mutation(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.lock_interaction_pair(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.interaction_is_blocked(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.guard_follow_insert()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_block_insert()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_reaction_insert()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_challenge_insert()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_stream_insert()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_submission_insert()
  from public, anon, authenticated, service_role;

comment on function public.can_view_challenge(uuid) is
  'RLS visibility gate for challenges. Staff bypass; every other read rejects account deletion, profile containment, participant/viewer blocks, and unauthorized visibility.';
comment on function public.can_view_profile(uuid) is
  'RLS visibility gate for profiles. Owner/staff bypass; every other read fails closed for symmetric blocks and active profile-limit/profile-remove restrictions.';
comment on function public.get_challenge_by_invite(text, text) is
  'Signed invite lookup for unexpired active/completed receipts; fails closed for deletion, profile containment, or any block between/viewer-and participants.';
comment on function public.get_challenge_match_entries(uuid) is
  'Authenticated participant-only matchup projection. Returns minimal private-profile identity plus judged delivery score/audio path after challenge and delivery containment gates.';
comment on function public.validate_challenge_entry() is
  'Serializes judged challenge admission, rejects account deletion, profile containment, and symmetric blocks, then atomically binds the first rival.';
comment on function public.remove_follows_on_block() is
  'Atomic block cascade: severs both-direction follows/reactions, cancels active bound challenges, and permanently revokes all bound invite receipts.';
comment on function public.lock_users_for_account_mutation(uuid[]) is
  'Internal shared account-deletion serialization lock. Returns false after locking when any supplied account has a durable deletion job.';
comment on function public.lock_interaction_pair(uuid, uuid) is
  'Internal unordered-pair serialization lock shared by follow, reaction, block, and challenge mutations.';
