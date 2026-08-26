-- Durable progression derived from trusted judged-delivery facts.
--
-- Progression is deliberately recomputed from canonical rows instead of accepting
-- client-supplied counters. This makes retries, duplicate Daily attempts, deletes,
-- score corrections, and visibility changes converge on the same result.

create index if not exists deliveries_user_daily_progress_idx
  on public.deliveries (user_id, daily_challenge_date, created_at, id)
  where state = 'judged' and daily_challenge_date is not null;

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
    select j.delivery_id
    from judged j
    order by j.achieved_at, j.delivery_id
    limit 1
  ),
  committed_bit as (
    select j.delivery_id
    from judged j
    where j.commitment >= 90
    order by j.achieved_at, j.delivery_id
    limit 1
  ),
  chaos_agent as (
    select j.delivery_id
    from judged j
    where j.chaos >= 95
    order by j.achieved_at, j.delivery_id
    limit 1
  ),
  perfectly_weird as (
    select j.delivery_id
    from judged j
    where j.overall = 100
    order by j.achieved_at, j.delivery_id
    limit 1
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
    select u.delivery_id
    from utc_day_deliveries u
    where u.delivery_number = 10
    order by u.score_date, u.delivery_id
    limit 1
  ),
  valid_daily_days as (
    select
      j.daily_challenge_date as challenge_date,
      (array_agg(j.delivery_id order by j.achieved_at, j.delivery_id))[1] as delivery_id
    from judged j
    join public.daily_challenges dc
      on dc.challenge_date = j.daily_challenge_date
     and dc.market = j.daily_challenge_market
     and dc.prompt_id = j.prompt_id
    where j.daily_challenge_date is not null
      and j.daily_challenge_market is not null
    group by j.daily_challenge_date
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
    select r.delivery_id
    from ranked_daily_days r
    where r.run_day = 5
    order by r.challenge_date, r.delivery_id
    limit 1
  ),
  daily_thirty as (
    select r.delivery_id
    from ranked_daily_days r
    where r.run_day = 30
    order by r.challenge_date, r.delivery_id
    limit 1
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
    select p.delivery_id
    from public_reactions p
    where p.reaction_number = 100
    limit 1
  ),
  friendly_fire as (
    select e.delivery_id
    from public.challenge_entries e
    join public.challenges c on c.id = e.challenge_id
    join public.deliveries d on d.id = e.delivery_id and d.state = 'judged'
    join public.delivery_scores s on s.delivery_id = e.delivery_id
    where e.entrant_id = p_user_id
      and c.state = 'completed'
    order by e.created_at, e.delivery_id
    limit 1
  ),
  category_firsts as (
    select distinct on (j.category)
      j.category,
      j.delivery_id,
      j.achieved_at
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
    select r.delivery_id
    from ranked_categories r
    where r.category_number = 4
    limit 1
  ),
  candidates (badge_id, delivery_id, metadata) as (
    select 'first-take', f.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'judgedDeliveries', 1)
    from first_take f
    union all
    select 'committed-bit', c.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'commitmentMin', 90)
    from committed_bit c
    union all
    select 'chaos-agent', c.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'chaosMin', 95)
    from chaos_agent c
    union all
    select 'perfectly-weird', p.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'overallMin', 100)
    from perfectly_weird p
    union all
    select 'one-more-round', o.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'dailyDeliveries', 10, 'timezone', 'UTC')
    from one_more_round o
    union all
    select 'daily-five', d.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'dailyStreak', 5)
    from daily_five d
    union all
    select 'daily-thirty', d.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'dailyStreak', 30)
    from daily_thirty d
    union all
    select 'crowd-favorite', c.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'publicReactionsReceived', 100)
    from crowd_favorite c
    union all
    select 'friendly-fire', f.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'completedChallenges', 1)
    from friendly_fire f
    union all
    select 'range', r.delivery_id,
      jsonb_build_object('ruleVersion', 1, 'categoriesAt85', 4)
    from range_badge r
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

  -- Serialize progression writes per player. After a concurrent writer commits,
  -- subsequent statements receive a fresh READ COMMITTED snapshot and converge.
  insert into public.user_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform s.user_id
  from public.user_stats s
  where s.user_id = p_user_id
  for update;

  with valid_daily_days as (
    select distinct d.daily_challenge_date as challenge_date
    from public.deliveries d
    join public.delivery_scores s on s.delivery_id = d.id
    join public.daily_challenges dc
      on dc.challenge_date = d.daily_challenge_date
     and dc.market = d.daily_challenge_market
     and dc.prompt_id = d.prompt_id
    where d.user_id = p_user_id
      and d.state = 'judged'
      and d.daily_challenge_date is not null
      and d.daily_challenge_market is not null
  ),
  labeled_daily_days as (
    select
      v.challenge_date,
      v.challenge_date - (row_number() over (order by v.challenge_date))::integer as run_key
    from valid_daily_days v
  ),
  daily_runs as (
    select
      max(l.challenge_date) as run_end,
      count(*)::integer as run_length
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
    where d.user_id = p_user_id
      and d.state = 'judged'
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

create or replace function public.advance_challenge_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_max smallint;
  entry_count integer;
  affected_user uuid;
begin
  select max_entries into target_max
  from public.challenges
  where id = new.challenge_id
  for update;

  select count(*) into entry_count
  from public.challenge_entries
  where challenge_id = new.challenge_id;

  update public.challenges
  set
    state = case when entry_count >= target_max then 'completed'::public.challenge_state else 'accepted'::public.challenge_state end,
    completed_at = case when entry_count >= target_max then now() else null end
  where id = new.challenge_id;

  if entry_count >= target_max then
    for affected_user in
      select distinct e.entrant_id
      from public.challenge_entries e
      where e.challenge_id = new.challenge_id
    loop
      perform public.award_progression_badges(affected_user);
    end loop;
  end if;

  return new;
end;
$$;

create or replace function public.set_delivery_visibility(
  p_delivery_id uuid,
  p_visibility public.delivery_visibility,
  p_user_id uuid default null
)
returns table (
  delivery_id uuid,
  visibility public.delivery_visibility,
  published_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_role text := auth.role();
  target_user_id uuid;
  delivery public.deliveries;
begin
  if caller_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may change delivery visibility';
  end if;
  target_user_id := p_user_id;
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'A target user is required';
  end if;
  if p_visibility not in ('private', 'public') then
    raise exception using errcode = '22023', message = 'Use public to publish or private to unpublish';
  end if;

  select * into delivery from public.deliveries where id = p_delivery_id for update;
  if not found or delivery.user_id is distinct from target_user_id then
    raise exception using errcode = '42501', message = 'Delivery not found for this user';
  end if;

  if p_visibility = 'public' then
    if delivery.state <> 'judged'
       or delivery.recording_path is null
       or not exists (select 1 from public.delivery_scores s where s.delivery_id = delivery.id) then
      raise exception using errcode = '55000', message = 'Only complete judged deliveries can be published';
    end if;
    if public.has_active_restriction(target_user_id, 'publish') then
      raise exception using errcode = '42501', message = 'Publishing is temporarily restricted';
    end if;
    if not ('publish-approved' = any(delivery.moderation_labels)) then
      raise exception using errcode = '42501', message = 'Explicit publishing approval is required';
    end if;
    if exists (
      select 1 from unnest(delivery.moderation_labels) as label
      where label in (
              'publish-rejected', 'publish-review', 'publish-limited',
              'publish-moderation-unavailable'
            )
         or label in ('harassment', 'hate', 'sexual', 'violence', 'self-harm', 'privacy')
    ) then
      raise exception using errcode = '42501', message = 'Delivery has not passed publishing review';
    end if;
  end if;

  update public.deliveries d
  set visibility = p_visibility,
      published_at = case when p_visibility = 'public' then coalesce(d.published_at, now()) else null end
  where d.id = delivery.id;

  -- Visibility is part of the profile rollup, so publish/unpublish must be
  -- reflected before this RPC reports success.
  perform public.refresh_user_rollups(target_user_id);

  return query
  select d.id, d.visibility, d.published_at from public.deliveries d where d.id = delivery.id;
end;
$$;

create or replace view public.leaderboard_live
with (security_invoker = true)
as
with scored as (
  select
    d.id as delivery_id,
    d.user_id,
    d.prompt_id,
    d.created_at,
    p.handle::text as handle,
    p.display_name,
    p.avatar_path,
    s.overall,
    s.commitment,
    s.comedy,
    s.chaos
  from public.deliveries d
  join public.delivery_scores s on s.delivery_id = d.id
  join public.profiles p on p.id = d.user_id
  where d.state = 'judged' and d.visibility = 'public' and not p.is_private
), expanded as (
  select s.*, period.period, metric.metric, metric.score
  from scored s
  cross join lateral (
    values
      ('daily'::text, now() - interval '24 hours'),
      ('weekly'::text, now() - interval '7 days'),
      ('all_time'::text, null::timestamptz)
  ) as period(period, cutoff)
  cross join lateral (
    values
      ('overall'::text, s.overall::numeric),
      ('commitment'::text, s.commitment::numeric),
      ('comedy'::text, s.comedy::numeric),
      ('chaos'::text, s.chaos::numeric)
  ) as metric(metric, score)
  where period.cutoff is null or s.created_at >= period.cutoff
), eligible_users as (
  select e.period, e.metric, e.user_id
  from expanded e
  group by e.period, e.metric, e.user_id
  having count(distinct e.prompt_id) >= 3
), personal_bests as (
  select distinct on (e.period, e.metric, e.user_id)
    e.period,
    e.metric,
    e.user_id,
    e.handle,
    e.display_name,
    e.avatar_path,
    e.delivery_id,
    e.score,
    e.created_at
  from expanded e
  join eligible_users q
    on q.period = e.period
   and q.metric = e.metric
   and q.user_id = e.user_id
  order by e.period, e.metric, e.user_id, e.score desc, e.created_at, e.delivery_id
)
select
  period,
  metric,
  dense_rank() over (partition by period, metric order by score desc)::integer as rank,
  user_id,
  handle,
  display_name,
  avatar_path,
  delivery_id,
  score,
  created_at
from personal_bests;

-- A stored counter cannot notice the passage of UTC midnight by itself. Read
-- current-streak state through this view so a run expires after one missed Daily
-- date even when the player has produced no subsequent write event.
create or replace view public.user_stats_live
with (security_invoker = true)
as
select
  s.user_id,
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
  case
    when s.last_daily_date between ((now() at time zone 'UTC')::date - 1)
                                  and (now() at time zone 'UTC')::date
      then s.current_daily_streak
    else 0
  end::integer as current_daily_streak,
  s.longest_daily_streak,
  s.last_daily_date,
  s.reactions_received,
  s.followers_count,
  s.following_count,
  s.updated_at
from public.user_stats s;

grant select on public.user_stats_live to anon, authenticated;

-- Replacing a function preserves its ACL in PostgreSQL, but repeat the intended
-- boundary explicitly so a future migration cannot accidentally expose mutation.
revoke all on function public.award_progression_badges(uuid) from public, anon, authenticated, service_role;
revoke all on function public.refresh_user_rollups(uuid) from public, anon, authenticated;
revoke all on function public.advance_challenge_state() from public, anon, authenticated;
revoke all on function public.set_delivery_visibility(uuid, public.delivery_visibility, uuid) from public, anon, authenticated;
grant execute on function public.set_delivery_visibility(uuid, public.delivery_visibility, uuid) to service_role;

comment on function public.award_progression_badges(uuid) is
  'Internal idempotent badge evaluator. Awards active seeded milestones from canonical judged deliveries, Daily rows, reactions, and completed challenges.';
comment on function public.refresh_user_rollups(uuid) is
  'Internal canonical rollup refresh. Serializes per user and derives distinct-date Daily streaks before awarding progression badges.';
comment on function public.set_delivery_visibility(uuid, public.delivery_visibility, uuid) is
  'Service-only publish/unpublish gate; public requires explicit moderation approval and the user rollup is refreshed atomically.';
comment on view public.leaderboard_live is
  'Live per-user personal bests by rolling period and score dimension; eligibility requires three distinct public judged prompts in that period.';
comment on view public.user_stats_live is
  'RLS-preserving stats read model that expires current_daily_streak after a missed UTC Daily date without mutating historical longest-streak state.';

-- Existing installations may already contain deliveries. Backfill counts, streaks,
-- and any badge definitions that were seeded before this migration was applied.
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
