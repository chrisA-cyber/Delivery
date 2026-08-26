-- Exactly one ranked Daily result per authenticated player, UTC date, and market.
-- Later scored takes persist as practice instead of replacing the ranked receipt.

alter table public.deliveries
  add column daily_ranked boolean not null default false;

alter table public.deliveries
  add constraint deliveries_ranked_requires_daily check (
    not daily_ranked
    or (daily_challenge_date is not null and daily_challenge_market is not null)
  );

create table public.daily_ranked_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_date date not null,
  market text not null,
  delivery_id uuid unique references public.deliveries(id) on delete set null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, challenge_date, market),
  foreign key (challenge_date, market)
    references public.daily_challenges(challenge_date, market) on delete restrict
);

alter table public.daily_ranked_claims enable row level security;
revoke all on public.daily_ranked_claims from anon, authenticated;
grant select, insert, update, delete on public.daily_ranked_claims to service_role;

-- Backfill the earliest durable judged result for existing installations before
-- installing the uniqueness boundary.
with ranked_existing as (
  select delivery_id
  from (
    select
      d.id as delivery_id,
      row_number() over (
        partition by d.user_id, d.daily_challenge_date, d.daily_challenge_market
        order by coalesce(d.scored_at, s.created_at, d.created_at), d.id
      ) as result_number
    from public.deliveries d
    join public.delivery_scores s on s.delivery_id = d.id
    join public.daily_challenges dc
      on dc.challenge_date = d.daily_challenge_date
     and dc.market = d.daily_challenge_market
     and dc.prompt_id = d.prompt_id
     and dc.energy_modifier_id = d.energy_modifier_id
    where d.state = 'judged'
      and d.daily_challenge_date is not null
      and d.daily_challenge_market is not null
      and d.daily_challenge_date <= (now() at time zone 'UTC')::date
      and d.daily_challenge_market = 'global'
  ) ranked
  where ranked.result_number = 1
)
update public.deliveries d
set daily_ranked = true
from ranked_existing r
where d.id = r.delivery_id;

insert into public.daily_ranked_claims (
  user_id, challenge_date, market, delivery_id, claimed_at
)
select
  d.user_id,
  d.daily_challenge_date,
  d.daily_challenge_market,
  d.id,
  coalesce(d.scored_at, s.created_at, d.created_at)
from public.deliveries d
join public.delivery_scores s on s.delivery_id = d.id
where d.daily_ranked
on conflict (user_id, challenge_date, market) do nothing;

create unique index deliveries_one_ranked_daily_idx
  on public.deliveries (user_id, daily_challenge_date, daily_challenge_market)
  where daily_ranked;

create or replace function public.initialize_delivery_daily_rank()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rank is assigned only when a trusted score insert succeeds. Neither a client
  -- nor a service retry may reserve the slot by inserting a processing delivery.
  new.daily_ranked := false;
  return new;
end;
$$;

create trigger deliveries_initialize_daily_rank
  before insert on public.deliveries
  for each row execute function public.initialize_delivery_daily_rank();

create or replace function public.assign_daily_rank_before_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  target_date date;
  target_market text;
  target_prompt_id uuid;
  target_energy_id uuid;
  lock_material text;
  claimed_delivery_id uuid;
  should_rank boolean;
begin
  select
    d.user_id,
    d.daily_challenge_date,
    d.daily_challenge_market,
    d.prompt_id,
    d.energy_modifier_id
  into
    target_user_id,
    target_date,
    target_market,
    target_prompt_id,
    target_energy_id
  from public.deliveries d
  where d.id = new.delivery_id
  for update;

  if not found then
    return new;
  end if;

  if target_date is null
     or target_market is null
     or target_date <> (now() at time zone 'UTC')::date
     or target_market <> 'global'
     or not exists (
       select 1
       from public.daily_challenges dc
       where dc.challenge_date = target_date
         and dc.market = target_market
         and dc.prompt_id = target_prompt_id
         and dc.energy_modifier_id = target_energy_id
     ) then
    update public.deliveries d
    set daily_ranked = false
    where d.id = new.delivery_id and d.daily_ranked;
    return new;
  end if;

  lock_material := target_user_id::text || ':' || target_date::text || ':' || target_market;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(lock_material, 202608250007)
  );

  claimed_delivery_id := null;
  insert into public.daily_ranked_claims (
    user_id, challenge_date, market, delivery_id
  )
  values (
    target_user_id, target_date, target_market, new.delivery_id
  )
  on conflict (user_id, challenge_date, market) do nothing
  returning delivery_id into claimed_delivery_id;

  if claimed_delivery_id is not null then
    should_rank := true;
  else
    select c.delivery_id is not distinct from new.delivery_id
    into should_rank
    from public.daily_ranked_claims c
    where c.user_id = target_user_id
      and c.challenge_date = target_date
      and c.market = target_market;
    should_rank := coalesce(should_rank, false);
  end if;

  update public.deliveries d
  set daily_ranked = should_rank
  where d.id = new.delivery_id;

  return new;
end;
$$;

create trigger delivery_scores_assign_daily_rank
  before insert on public.delivery_scores
  for each row execute function public.assign_daily_rank_before_score();

-- Only ranked Daily receipts advance Daily-specific streaks and badges. Practice
-- takes remain normal judged deliveries for general history and performance stats.
create or replace function public.award_progression_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or not exists (select 1 from public.profiles p where p.id = p_user_id) then
    return;
  end if;

  with judged as (
    select
      d.id as delivery_id,
      d.prompt_id,
      d.daily_challenge_date,
      d.daily_challenge_market,
      coalesce(d.scored_at, s.created_at, d.created_at) as achieved_at,
      p.category,
      s.overall,
      s.commitment,
      s.chaos
    from public.deliveries d
    join public.delivery_scores s on s.delivery_id = d.id
    join public.prompts p on p.id = d.prompt_id
    where d.user_id = p_user_id
      and d.state = 'judged'
  ),
  first_take as (
    select j.delivery_id from judged j
    order by j.achieved_at, j.delivery_id limit 1
  ),
  committed_bit as (
    select j.delivery_id from judged j where j.commitment >= 90
    order by j.achieved_at, j.delivery_id limit 1
  ),
  chaos_agent as (
    select j.delivery_id from judged j where j.chaos >= 95
    order by j.achieved_at, j.delivery_id limit 1
  ),
  perfectly_weird as (
    select j.delivery_id from judged j where j.overall = 100
    order by j.achieved_at, j.delivery_id limit 1
  ),
  utc_day_deliveries as (
    select
      j.delivery_id,
      (j.achieved_at at time zone 'UTC')::date as score_date,
      row_number() over (
        partition by (j.achieved_at at time zone 'UTC')::date
        order by j.achieved_at, j.delivery_id
      ) as delivery_number
    from judged j
  ),
  one_more_round as (
    select u.delivery_id from utc_day_deliveries u
    where u.delivery_number = 10
    order by u.score_date, u.delivery_id limit 1
  ),
  valid_daily_days as (
    select distinct on (c.challenge_date)
      c.challenge_date,
      c.delivery_id
    from public.daily_ranked_claims c
    where c.user_id = p_user_id
    order by
      c.challenge_date,
      (c.delivery_id is null),
      c.delivery_id,
      c.market
  ),
  labeled_daily_days as (
    select
      v.challenge_date,
      v.delivery_id,
      v.challenge_date - (row_number() over (order by v.challenge_date))::integer as run_key
    from valid_daily_days v
  ),
  ranked_daily_days as (
    select
      l.challenge_date,
      l.delivery_id,
      row_number() over (partition by l.run_key order by l.challenge_date) as run_day
    from labeled_daily_days l
  ),
  daily_five as (
    select r.delivery_id from ranked_daily_days r
    where r.run_day = 5 order by r.challenge_date, r.delivery_id limit 1
  ),
  daily_thirty as (
    select r.delivery_id from ranked_daily_days r
    where r.run_day = 30 order by r.challenge_date, r.delivery_id limit 1
  ),
  public_reactions as (
    select
      r.delivery_id,
      row_number() over (order by r.created_at, r.delivery_id, r.user_id) as reaction_number
    from public.reactions r
    join public.deliveries d on d.id = r.delivery_id
    join public.delivery_scores s on s.delivery_id = d.id
    where d.user_id = p_user_id
      and d.state = 'judged'
      and d.visibility = 'public'
  ),
  crowd_favorite as (
    select p.delivery_id from public_reactions p where p.reaction_number = 100 limit 1
  ),
  friendly_fire as (
    select e.delivery_id
    from public.challenge_entries e
    join public.challenges c on c.id = e.challenge_id
    join public.deliveries d on d.id = e.delivery_id and d.state = 'judged'
    join public.delivery_scores s on s.delivery_id = e.delivery_id
    where e.entrant_id = p_user_id and c.state = 'completed'
    order by e.created_at, e.delivery_id limit 1
  ),
  category_firsts as (
    select distinct on (j.category)
      j.category, j.delivery_id, j.achieved_at
    from judged j
    where j.overall >= 85
    order by j.category, j.achieved_at, j.delivery_id
  ),
  ranked_categories as (
    select
      c.delivery_id,
      row_number() over (order by c.achieved_at, c.delivery_id, c.category) as category_number
    from category_firsts c
  ),
  range_badge as (
    select r.delivery_id from ranked_categories r where r.category_number = 4 limit 1
  ),
  candidates (badge_id, delivery_id, metadata) as (
    select 'first-take', f.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'judgedDeliveries', 1) from first_take f
    union all
    select 'committed-bit', c.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'commitmentMin', 90) from committed_bit c
    union all
    select 'chaos-agent', c.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'chaosMin', 95) from chaos_agent c
    union all
    select 'perfectly-weird', p.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'overallMin', 100) from perfectly_weird p
    union all
    select 'one-more-round', o.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'dailyDeliveries', 10, 'timezone', 'UTC') from one_more_round o
    union all
    select 'daily-five', d.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'dailyStreak', 5) from daily_five d
    union all
    select 'daily-thirty', d.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'dailyStreak', 30) from daily_thirty d
    union all
    select 'crowd-favorite', c.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'publicReactionsReceived', 100) from crowd_favorite c
    union all
    select 'friendly-fire', f.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'completedChallenges', 1) from friendly_fire f
    union all
    select 'range', r.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'categoriesAt85', 4) from range_badge r
  )
  insert into public.user_badges (user_id, badge_id, delivery_id, metadata)
  select p_user_id, c.badge_id, c.delivery_id, c.metadata
  from candidates c
  join public.badges b on b.id = c.badge_id and b.is_active
  on conflict (user_id, badge_id) do nothing;
end;
$$;

create or replace function public.refresh_user_rollups(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null
     or not exists (select 1 from public.profiles p where p.id = p_user_id) then
    return;
  end if;

  insert into public.user_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform s.user_id
  from public.user_stats s
  where s.user_id = p_user_id
  for update;

  with valid_daily_days as (
    select distinct c.challenge_date
    from public.daily_ranked_claims c
    where c.user_id = p_user_id
  ),
  labeled_daily_days as (
    select
      v.challenge_date,
      v.challenge_date - (row_number() over (order by v.challenge_date))::integer as run_key
    from valid_daily_days v
  ),
  daily_runs as (
    select max(l.challenge_date) as run_end, count(*)::integer as run_length
    from labeled_daily_days l
    group by l.run_key
  ),
  daily_summary as (
    select
      case
        when max(r.run_end) between ((now() at time zone 'UTC')::date - 1)
                                 and (now() at time zone 'UTC')::date
          then coalesce((array_agg(r.run_length order by r.run_end desc))[1], 0)::integer
        else 0
      end as current_streak,
      coalesce(max(r.run_length), 0)::integer as longest_streak,
      (select max(v.challenge_date) from valid_daily_days v) as last_daily_date
    from daily_runs r
  ),
  score_summary as (
    select
      count(s.delivery_id)::integer as judged_deliveries,
      count(s.delivery_id) filter (where d.visibility = 'public')::integer as public_deliveries,
      coalesce(sum(s.overall), 0)::bigint as score_sum,
      coalesce(round(avg(s.overall), 2), 0) as average_score,
      coalesce(max(s.overall), 0)::smallint as best_score,
      coalesce(round(avg(s.commitment), 2), 0) as average_commitment,
      coalesce(round(avg(s.comedy), 2), 0) as average_comedy,
      round(avg(s.accuracy), 2) as average_accuracy,
      coalesce(round(avg(s.chaos), 2), 0) as average_chaos,
      (array_agg(d.id order by s.overall desc, d.created_at, d.id)
        filter (where s.delivery_id is not null))[1] as best_delivery_id,
      (
        select count(*)
        from public.reactions r
        join public.deliveries rd on rd.id = r.delivery_id
        where rd.user_id = p_user_id
      ) as reactions_received
    from public.deliveries d
    left join public.delivery_scores s on s.delivery_id = d.id
    where d.user_id = p_user_id and d.state = 'judged'
  )
  insert into public.user_stats (
    user_id, judged_deliveries, public_deliveries, score_sum, average_score,
    best_score, average_commitment, average_comedy, average_accuracy,
    average_chaos, best_delivery_id, current_daily_streak,
    longest_daily_streak, last_daily_date, reactions_received, updated_at
  )
  select
    p_user_id,
    s.judged_deliveries,
    s.public_deliveries,
    s.score_sum,
    s.average_score,
    s.best_score,
    s.average_commitment,
    s.average_comedy,
    s.average_accuracy,
    s.average_chaos,
    s.best_delivery_id,
    d.current_streak,
    d.longest_streak,
    d.last_daily_date,
    s.reactions_received,
    now()
  from score_summary s
  cross join daily_summary d
  on conflict (user_id) do update set
    judged_deliveries = excluded.judged_deliveries,
    public_deliveries = excluded.public_deliveries,
    score_sum = excluded.score_sum,
    average_score = excluded.average_score,
    best_score = excluded.best_score,
    average_commitment = excluded.average_commitment,
    average_comedy = excluded.average_comedy,
    average_accuracy = excluded.average_accuracy,
    average_chaos = excluded.average_chaos,
    best_delivery_id = excluded.best_delivery_id,
    current_daily_streak = excluded.current_daily_streak,
    longest_daily_streak = excluded.longest_daily_streak,
    last_daily_date = excluded.last_daily_date,
    reactions_received = excluded.reactions_received,
    updated_at = now();

  delete from public.user_category_stats where user_id = p_user_id;
  insert into public.user_category_stats (
    user_id, category, judged_deliveries, average_score, best_score,
    average_commitment, average_comedy, average_accuracy, average_chaos, updated_at
  )
  select
    p_user_id,
    p.category,
    count(*)::integer,
    round(avg(s.overall), 2),
    max(s.overall)::smallint,
    round(avg(s.commitment), 2),
    round(avg(s.comedy), 2),
    round(avg(s.accuracy), 2),
    round(avg(s.chaos), 2),
    now()
  from public.deliveries d
  join public.delivery_scores s on s.delivery_id = d.id
  join public.prompts p on p.id = d.prompt_id
  where d.user_id = p_user_id and d.state = 'judged'
  group by p.category;

  perform public.award_progression_badges(p_user_id);
end;
$$;

revoke all on function public.initialize_delivery_daily_rank() from public, anon, authenticated, service_role;
revoke all on function public.assign_daily_rank_before_score() from public, anon, authenticated, service_role;
revoke all on function public.award_progression_badges(uuid) from public, anon, authenticated, service_role;
revoke all on function public.refresh_user_rollups(uuid) from public, anon, authenticated;

-- A block is symmetric for discovery and sharing: neither side may continue to
-- inspect the other through profiles, feeds, leaderboards, challenge receipts, or
-- stream-host access. Owners and staff retain their existing administrative paths.
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
          not exists (
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

create or replace function public.can_view_delivery(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.profiles p on p.id = d.user_id
    where d.id = p_delivery_id
      and (
        d.user_id = (select auth.uid())
        or public.is_staff()
        or (
          not exists (
            select 1
            from public.blocks b
            where (b.blocker_id = d.user_id and b.blocked_id = (select auth.uid()))
               or (b.blocker_id = (select auth.uid()) and b.blocked_id = d.user_id)
          )
          and (
            (
              d.state = 'judged'
              and (select auth.uid()) is not null
              and d.challenge_id is not null
              and exists (
                select 1
                from public.challenges c
                where c.id = d.challenge_id
                  and (c.created_by = (select auth.uid()) or c.recipient_user_id = (select auth.uid()))
              )
            )
            or (
              d.state = 'judged'
              and (select auth.uid()) is not null
              and d.stream_session_id is not null
              and exists (
                select 1
                from public.stream_sessions ss
                where ss.id = d.stream_session_id and ss.host_id = (select auth.uid())
              )
            )
            or (
              d.state = 'judged'
              and d.visibility = 'public'
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
        )
      )
  );
$$;

-- Core already installs the atomic, bidirectional follow cleanup trigger. Keep it
-- trigger-only after moving block mutations behind the server API.
revoke all on function public.remove_follows_on_block() from public, anon, authenticated, service_role;

-- Collapse case and whitespace before hashing so concurrent, cosmetically varied
-- copies cannot occupy multiple moderation slots. Rejected/archived ideas may be
-- revised and resubmitted; active review and accepted rows remain authoritative.
alter table public.line_submissions
  add column normalized_body_hash bytea generated always as (
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.lower(
          pg_catalog.regexp_replace(
            pg_catalog.btrim(proposed_body),
            '[[:space:]]+',
            ' ',
            'g'
          )
        ),
        'UTF8'
      ),
      'sha256'
    )
  ) stored;

-- Non-empty upgrades may already contain case/whitespace variants. Retain the
-- earliest active row deterministically and preserve every later row as rejected
-- moderation history before installing the unique boundary.
with ranked_active as (
  select
    s.id,
    first_value(s.id) over (
      partition by s.normalized_body_hash
      order by s.created_at, s.id
    ) as retained_id,
    row_number() over (
      partition by s.normalized_body_hash
      order by s.created_at, s.id
    ) as duplicate_number
  from public.line_submissions s
  where s.state in ('review', 'published')
), duplicate_active as (
  select r.id, r.retained_id
  from ranked_active r
  where r.duplicate_number > 1
)
update public.line_submissions s
set state = 'rejected',
    reviewer_note = pg_catalog.concat_ws(
      E'\n',
      nullif(pg_catalog.btrim(s.reviewer_note), ''),
      'Automatically rejected during duplicate-hash migration; retained active submission '
        || d.retained_id::text || '.'
    ),
    reviewed_at = coalesce(s.reviewed_at, now()),
    updated_at = now()
from duplicate_active d
where s.id = d.id;

create unique index line_submissions_active_body_hash_idx
  on public.line_submissions (normalized_body_hash)
  where state in ('review', 'published');

-- Serious safety reports may be submitted without an account. The API supplies
-- keyed, rotating device/network digests; raw device identifiers and IP addresses
-- are never stored. Signed reports keep their account identity and no anon hashes.
alter table public.reports
  alter column reporter_id drop not null,
  add column anonymous_reporter_hash text,
  add column anonymous_network_hash text,
  add constraint reports_reporter_identity check (
    (
      reporter_id is not null
      and anonymous_reporter_hash is null
      and anonymous_network_hash is null
    )
    or (
      reporter_id is null
      and anonymous_reporter_hash is not null
      and anonymous_network_hash is not null
    )
  ),
  add constraint reports_anonymous_reporter_hash_format check (
    anonymous_reporter_hash is null
    or anonymous_reporter_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint reports_anonymous_network_hash_format check (
    anonymous_network_hash is null
    or anonymous_network_hash ~ '^[0-9a-f]{64}$'
  );

create index reports_anonymous_reporter_rate_idx
  on public.reports (anonymous_reporter_hash, created_at desc)
  where anonymous_reporter_hash is not null;
create index reports_anonymous_network_rate_idx
  on public.reports (anonymous_network_hash, created_at desc)
  where anonymous_network_hash is not null;

comment on function public.can_view_profile(uuid) is
  'Visibility gate with symmetric blocks: a block by either account hides the target profile.';
comment on function public.can_view_delivery(uuid) is
  'Delivery visibility gate with symmetric blocks across public, challenge, and stream access paths.';
comment on function public.remove_follows_on_block() is
  'Internal block trigger that removes follows in both directions so unblocking never restores access.';
comment on column public.line_submissions.normalized_body_hash is
  'Generated SHA-256 of the case-folded, whitespace-collapsed proposed line; active review/published rows are unique.';
comment on column public.reports.anonymous_reporter_hash is
  'Keyed 64-hex device digest for anonymous abuse throttling; never store the raw identifier.';
comment on column public.reports.anonymous_network_hash is
  'Keyed 64-hex network digest for anonymous abuse throttling; never store an IP address.';

-- Browser clients read their authorized rows, but all recording persistence and
-- cleanup flows through validated server routes using the service role. Removing
-- direct mutations prevents bypassing audio validation, quota, rate limits, and
-- Storage cleanup.
drop policy if exists "users create own deliveries" on public.deliveries;
drop policy if exists "users delete own deliveries" on public.deliveries;
revoke insert (
  user_id, prompt_id, energy_modifier_id, challenge_id, stream_session_id,
  daily_challenge_date, daily_challenge_market, state, visibility,
  recording_path, mime_type, duration_ms, byte_size, waveform, transcript, take_count
) on public.deliveries from authenticated;
revoke delete on public.deliveries from authenticated;
drop policy if exists "owners upload recordings" on storage.objects;

-- Submission/report APIs perform normalization, moderation, target-visibility
-- checks, and rate limiting before their admin writes. Direct PostgREST inserts
-- would bypass those controls.
drop policy if exists "users submit lines" on public.line_submissions;
revoke insert (
  submitted_by, proposed_body, proposed_category, proposed_tags,
  suggested_energy, state, automated_labels, automated_scores
) on public.line_submissions from authenticated;
revoke insert (
  submitted_by, proposed_body, proposed_category, proposed_tags,
  suggested_energy, state, automated_labels, automated_scores
) on public.user_submissions from authenticated;

drop policy if exists "users create reports" on public.reports;
revoke insert (
  reporter_id, delivery_id, profile_id, prompt_id,
  submission_id, reason, details, state
) on public.reports from authenticated;

-- Reaction/follow routes validate target visibility and apply rate limits before
-- writing as the service role. Browser mutations would bypass those gates.
drop policy if exists "users react as themselves" on public.reactions;
drop policy if exists "users change own reaction" on public.reactions;
drop policy if exists "users remove own reaction" on public.reactions;
revoke insert, update, delete on public.reactions from authenticated;

drop policy if exists "users follow as themselves" on public.follows;
drop policy if exists "users unfollow as themselves" on public.follows;
revoke insert, delete on public.follows from authenticated;

-- The block API performs the authoritative mutation. Its insert trigger also
-- severs follows in both directions in the same transaction.
drop policy if exists "users block as themselves" on public.blocks;
drop policy if exists "users unblock as themselves" on public.blocks;
revoke insert, delete on public.blocks from authenticated;

-- Challenge creation also flows through the rate-limited Pro API so clients cannot
-- mint arbitrary invite tokens or bypass entitlement. Derived state is trigger-owned.
drop policy if exists "users create challenges" on public.challenges;
revoke insert (
  code, token_digest, created_by, recipient_user_id, prompt_id,
  energy_modifier_id, state, visibility, message, max_entries, expires_at
) on public.challenges from authenticated;
revoke update (
  recipient_user_id, state, visibility, message, expires_at, completed_at
) on public.challenges from authenticated;
revoke delete on public.challenges from authenticated;

comment on column public.deliveries.daily_ranked is
  'True only for the first successfully inserted score for today''s canonical global UTC Daily; later or noncanonical results are practice.';
comment on table public.daily_ranked_claims is
  'Internal immutable first-result ledger. The claim survives delivery deletion so deleting audio cannot reopen a ranked Daily slot.';
comment on function public.assign_daily_rank_before_score() is
  'Internal score trigger that validates today''s canonical global prompt and energy, then serializes one ranked Daily receipt per user/date/market. Assignment rolls back with a failed score insert.';

do $$
declare
  target_user_id uuid;
begin
  for target_user_id in select p.id from public.profiles p order by p.id
  loop
    perform public.refresh_user_rollups(target_user_id);
  end loop;
end;
$$;
