-- Canonical current-UTC Daily boards. Every metric ranks the same immutable
-- first-scored receipt; practice takes can never replace or farm that entry.

create index if not exists deliveries_ranked_daily_board_idx
  on public.deliveries (
    daily_challenge_date,
    daily_challenge_market,
    user_id,
    scored_at,
    id
  )
  include (prompt_id, energy_modifier_id, visibility, state)
  where daily_ranked;

-- The durable claim ledger is intentionally not selectable by clients. This
-- narrow predicate lets the security-invoker view prove a visible delivery is the
-- canonical current receipt without exposing historical claim/tombstone rows.
create or replace function public.is_canonical_daily_ranked_delivery(
  p_delivery_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.daily_ranked_claims c
    join public.deliveries d
      on d.id = c.delivery_id
     and d.user_id = c.user_id
     and d.daily_challenge_date = c.challenge_date
     and d.daily_challenge_market = c.market
    join public.daily_challenges dc
      on dc.challenge_date = c.challenge_date
     and dc.market = c.market
     and dc.prompt_id = d.prompt_id
     and dc.energy_modifier_id = d.energy_modifier_id
    join public.profiles p on p.id = d.user_id
    join public.prompts pr on pr.id = d.prompt_id
    where d.id = p_delivery_id
      and c.challenge_date = (now() at time zone 'UTC')::date
      and c.market = 'global'
      and d.daily_ranked
      and d.state = 'judged'
      and d.visibility = 'public'
      and not p.is_private
      and pr.state = 'published'
      and not public.has_active_restriction(d.user_id, 'profile-limit')
      and not public.has_active_restriction(d.user_id, 'profile-remove')
      and not exists (
        select 1
        from public.account_deletion_jobs j
        where j.user_id = d.user_id
      )
      and not (
        d.moderation_labels && array[
          'publish-rejected',
          'publish-review',
          'publish-limited',
          'publish-moderation-unavailable',
          'moderator-limited',
          'moderator-removed',
          'account-deletion',
          'harassment',
          'hate',
          'sexual',
          'violence',
          'self-harm',
          'privacy'
        ]::text[]
      )
      and public.can_view_delivery(d.id)
  );
$$;

create or replace view public.daily_leaderboard_live
with (security_invoker = true, security_barrier = true)
as
with eligible as (
  select
    dc.challenge_date,
    dc.market,
    d.user_id,
    p.handle::text as handle,
    p.display_name,
    p.avatar_path,
    d.id as delivery_id,
    d.prompt_id,
    d.energy_modifier_id,
    s.overall,
    s.commitment,
    s.comedy,
    s.accuracy,
    s.chaos,
    s.headline,
    coalesce(d.scored_at, s.created_at, d.created_at) as created_at
  from public.daily_challenges dc
  join public.deliveries d
    on d.daily_challenge_date = dc.challenge_date
   and d.daily_challenge_market = dc.market
   and d.prompt_id = dc.prompt_id
   and d.energy_modifier_id = dc.energy_modifier_id
  join public.delivery_scores s on s.delivery_id = d.id
  join public.profiles p on p.id = d.user_id
  where dc.challenge_date = (now() at time zone 'UTC')::date
    and dc.market = 'global'
    and public.is_canonical_daily_ranked_delivery(d.id)
), expanded as (
  select
    e.*,
    metric.metric,
    metric.score,
    metric.tie_break_score
  from eligible e
  cross join lateral (
    values
      ('overall'::text, e.overall::numeric, e.commitment::numeric),
      ('commitment'::text, e.commitment::numeric, e.overall::numeric),
      ('comedy'::text, e.comedy::numeric, e.overall::numeric),
      ('chaos'::text, e.chaos::numeric, e.overall::numeric)
  ) as metric(metric, score, tie_break_score)
), ranked as (
  select
    'daily'::text as period,
    e.metric,
    row_number() over (
      partition by e.metric
      order by
        e.score desc,
        e.tie_break_score desc,
        e.created_at,
        e.delivery_id
    )::integer as rank,
    count(*) over (partition by e.metric)::integer as participant_count,
    e.challenge_date,
    e.market,
    e.user_id,
    e.handle,
    e.display_name,
    e.avatar_path,
    e.delivery_id,
    e.prompt_id,
    e.energy_modifier_id,
    e.score,
    e.overall,
    e.commitment,
    e.comedy,
    e.accuracy,
    e.chaos,
    e.headline,
    e.created_at
  from expanded e
)
select
  r.period,
  r.metric,
  r.rank,
  r.participant_count,
  r.challenge_date,
  r.market,
  r.user_id,
  r.handle,
  r.display_name,
  r.avatar_path,
  r.delivery_id,
  r.prompt_id,
  r.energy_modifier_id,
  r.score,
  r.overall,
  r.commitment,
  r.comedy,
  r.accuracy,
  r.chaos,
  r.headline,
  r.created_at
from ranked r;

-- Top-N consumers query the view. This current-viewer lookup uses the exact same
-- RLS-ranked relation, so a player can still see “#347 of 2,104” without asking
-- the API to return or cache every intervening profile.
create or replace function public.get_daily_leaderboard_position(
  p_metric text default 'overall',
  p_market text default 'global'
)
returns table (
  period text,
  metric text,
  rank integer,
  participant_count integer,
  challenge_date date,
  market text,
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  delivery_id uuid,
  prompt_id uuid,
  energy_modifier_id uuid,
  score numeric,
  overall smallint,
  commitment smallint,
  comedy smallint,
  accuracy smallint,
  chaos smallint,
  headline text,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  normalized_metric text := pg_catalog.lower(
    coalesce(nullif(pg_catalog.btrim(p_metric), ''), 'overall')
  );
  normalized_market text := pg_catalog.lower(
    coalesce(nullif(pg_catalog.btrim(p_market), ''), 'global')
  );
begin
  if normalized_metric not in ('overall', 'commitment', 'comedy', 'chaos') then
    raise exception using errcode = '22023', message = 'Unknown Daily leaderboard metric';
  end if;
  if normalized_market <> 'global' then
    raise exception using errcode = '22023', message = 'Only the global Daily leaderboard is available';
  end if;
  if auth.uid() is null then
    return;
  end if;

  return query
  select
    b.period,
    b.metric,
    b.rank,
    b.participant_count,
    b.challenge_date,
    b.market,
    b.user_id,
    b.handle,
    b.display_name,
    b.avatar_path,
    b.delivery_id,
    b.prompt_id,
    b.energy_modifier_id,
    b.score,
    b.overall,
    b.commitment,
    b.comedy,
    b.accuracy,
    b.chaos,
    b.headline,
    b.created_at
  from public.daily_leaderboard_live b
  where b.metric = normalized_metric
    and b.market = normalized_market
    and b.user_id = auth.uid()
  order by b.rank
  limit 1;
end;
$$;

revoke all on function public.is_canonical_daily_ranked_delivery(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_canonical_daily_ranked_delivery(uuid)
  to anon, authenticated, service_role;

grant select on public.daily_leaderboard_live to anon, authenticated, service_role;

revoke all on function public.get_daily_leaderboard_position(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_daily_leaderboard_position(text, text)
  to authenticated;

comment on function public.is_canonical_daily_ranked_delivery(uuid) is
  'Narrow RLS-aware proof that a visible public take is today''s exact global prompt+energy durable ranked claim and has no active moderation/deletion containment.';
comment on view public.daily_leaderboard_live is
  'Viewer-scoped current UTC global Daily ranks for overall/commitment/comedy/chaos. One immutable durable claim per user; private, blocked, moderated, deleted, noncanonical, and practice rows are excluded.';
comment on function public.get_daily_leaderboard_position(text, text) is
  'Authenticated current-viewer position for the canonical Daily metric board, including participant_count even when the viewer falls below an API top-N response.';
