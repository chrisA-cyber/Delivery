-- Durable, atomic judged-play reservations. Reserve before model work; release only
-- when the provider fails to produce a judgment.

create type public.judged_play_claim_state as enum ('pending', 'reserved', 'released', 'denied');

create table public.judged_play_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_key text not null,
  period_start date not null,
  state public.judged_play_claim_state not null default 'pending',
  used_after integer not null default 0,
  limit_snapshot integer,
  tier_snapshot public.plan_tier not null default 'free',
  reset_at timestamptz not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, attempt_key),
  constraint judged_play_claims_attempt_key check (
    char_length(attempt_key) between 8 and 128
    and attempt_key ~ '^[A-Za-z0-9:_.-]+$'
  ),
  constraint judged_play_claims_used_nonnegative check (used_after >= 0),
  constraint judged_play_claims_limit_positive check (limit_snapshot is null or limit_snapshot > 0),
  constraint judged_play_claims_release_state check (
    (state = 'released' and released_at is not null)
    or (state <> 'released' and released_at is null)
  )
);

create index judged_play_claims_retention_idx on public.judged_play_claims (updated_at);
alter table public.judged_play_claims enable row level security;

create or replace function public.reserve_judged_play(
  p_attempt_key text,
  p_user_id uuid default null
)
returns table (
  claim_id uuid,
  allowed boolean,
  used integer,
  play_limit integer,
  remaining integer,
  reset_at timestamptz,
  tier public.plan_tier,
  replayed boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  target_user_id uuid;
  utc_period date := (now() at time zone 'UTC')::date;
  next_reset timestamptz := ((now() at time zone 'UTC')::date + 1)::timestamp at time zone 'UTC';
  inserted_count integer := 0;
  claim public.judged_play_claims;
  current_used integer;
  current_tier public.plan_tier := 'free';
  current_limit integer := 5;
  is_allowed boolean;
begin
  if p_attempt_key is null
     or char_length(p_attempt_key) not between 8 and 128
     or p_attempt_key !~ '^[A-Za-z0-9:_.-]+$' then
    raise exception using errcode = '22023', message = 'Invalid judged-play attempt key';
  end if;
  if caller_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may reserve quota';
  end if;

  target_user_id := coalesce(p_user_id, caller_id);
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'A target user is required for service-role calls';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception using errcode = '23503', message = 'Delivery profile not found';
  end if;

  -- Unique insert serializes concurrent retries of the same attempt. A loser waits
  -- for the winner's transaction and then returns its durable snapshot.
  insert into public.judged_play_claims (
    user_id, attempt_key, period_start, state, reset_at
  )
  values (target_user_id, p_attempt_key, utc_period, 'pending', next_reset)
  on conflict (user_id, attempt_key) do nothing;
  get diagnostics inserted_count = row_count;

  select * into claim
  from public.judged_play_claims
  where user_id = target_user_id and attempt_key = p_attempt_key
  for update;

  if inserted_count = 0
     and (claim.state = 'reserved' or (claim.state = 'denied' and claim.period_start = utc_period)) then
    return query select
      claim.id,
      claim.state = 'reserved',
      claim.used_after,
      claim.limit_snapshot,
      case when claim.limit_snapshot is null then null else greatest(claim.limit_snapshot - claim.used_after, 0) end,
      claim.reset_at,
      claim.tier_snapshot,
      true;
    return;
  end if;

  -- A released provider failure may retry with the same attempt key. It becomes a
  -- fresh reservation and is charged again only if capacity is available.
  update public.judged_play_claims
  set period_start = utc_period,
      state = 'pending',
      used_after = 0,
      limit_snapshot = 5,
      tier_snapshot = 'free',
      reset_at = next_reset,
      released_at = null,
      updated_at = now()
  where id = claim.id;

  insert into public.usage_counters (user_id, period_start)
  values (target_user_id, utc_period)
  on conflict (user_id, period_start) do nothing;

  select plays into current_used
  from public.usage_counters
  where user_id = target_user_id and period_start = utc_period
  for update;

  if exists (
    select 1 from public.subscriptions s
    where s.user_id = target_user_id
      and s.tier = 'pro'
      and s.state in ('trialing', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
  ) then
    current_tier := 'pro';
    current_limit := null;
  end if;

  is_allowed := current_limit is null or current_used < current_limit;
  if is_allowed then
    update public.usage_counters
    set plays = plays + 1,
        ai_scores = ai_scores + 1,
        updated_at = now()
    where user_id = target_user_id and period_start = utc_period
    returning plays into current_used;
  end if;

  update public.judged_play_claims
  set state = case when is_allowed then 'reserved'::public.judged_play_claim_state else 'denied'::public.judged_play_claim_state end,
      used_after = current_used,
      limit_snapshot = current_limit,
      tier_snapshot = current_tier,
      reset_at = next_reset,
      updated_at = now()
  where id = claim.id;

  return query select
    claim.id,
    is_allowed,
    current_used,
    current_limit,
    case when current_limit is null then null else greatest(current_limit - current_used, 0) end,
    next_reset,
    current_tier,
    false;
end;
$$;

create or replace function public.release_judged_play(
  p_claim_id uuid,
  p_user_id uuid default null
)
returns table (released boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
  claim public.judged_play_claims;
begin
  if caller_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may release quota';
  end if;

  select * into claim from public.judged_play_claims where id = p_claim_id for update;
  if not found then return query select false; return; end if;
  if p_user_id is not null and p_user_id is distinct from claim.user_id then
    raise exception using errcode = '42501', message = 'Claim does not belong to target user';
  end if;
  if claim.state <> 'reserved' then return query select false; return; end if;

  perform 1 from public.usage_counters
  where user_id = claim.user_id and period_start = claim.period_start
  for update;

  update public.usage_counters
  set plays = greatest(plays - 1, 0),
      ai_scores = greatest(ai_scores - 1, 0),
      updated_at = now()
  where user_id = claim.user_id and period_start = claim.period_start;

  update public.judged_play_claims
  set state = 'released', released_at = now(), updated_at = now()
  where id = claim.id;

  return query select true;
end;
$$;

revoke all on table public.judged_play_claims from anon, authenticated;
revoke all on function public.reserve_judged_play(text, uuid) from public, anon, authenticated;
revoke all on function public.release_judged_play(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_judged_play(text, uuid) to service_role;
grant execute on function public.release_judged_play(uuid, uuid) to service_role;

comment on table public.judged_play_claims is 'Durable attempt reservations. Retain longer than judge idempotency responses; successful reservations are not released.';
comment on function public.reserve_judged_play(text, uuid) is 'Service-only: Free users receive five judged plays per UTC day; active/trialing Pro is unlimited. Replays return the original reservation.';
comment on function public.release_judged_play(uuid, uuid) is 'Service-only, exactly-once refund for provider failures before a judgment is produced.';
