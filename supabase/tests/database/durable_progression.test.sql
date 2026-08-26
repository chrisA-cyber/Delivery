begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(44);

select has_function('public', 'award_progression_badges', array['uuid']);
select has_function('public', 'refresh_user_rollups', array['uuid']);
select has_view('public', 'user_stats_live');
select ok(
  not has_function_privilege('anon', 'public.award_progression_badges(uuid)', 'EXECUTE'),
  'anonymous users cannot invoke the internal badge evaluator'
);
select ok(
  not has_function_privilege('authenticated', 'public.award_progression_badges(uuid)', 'EXECUTE'),
  'authenticated users cannot award their own badges'
);
select ok(
  not has_function_privilege('service_role', 'public.award_progression_badges(uuid)', 'EXECUTE'),
  'even the service API cannot directly award badges outside trusted triggers'
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.award_progression_badges(uuid)'::regprocedure),
  'the trigger-only badge evaluator is security definer'
);
select ok(
  position(
    'refresh_user_rollups' in pg_get_functiondef(
      'public.set_delivery_visibility(uuid,delivery_visibility,uuid)'::regprocedure
    )
  ) > 0,
  'checked publish and unpublish refresh the owner rollup atomically'
);
select ok(
  position(
    'count(distinct e.prompt_id) >= 3' in lower(pg_get_viewdef('public.leaderboard_live'::regclass, true))
  ) > 0,
  'live leaderboard eligibility requires three distinct prompts per period and metric'
);
select ok((select relrowsecurity from pg_class where oid = 'public.user_badges'::regclass), 'user_badges has RLS');
select ok(
  not has_table_privilege('authenticated', 'public.user_badges', 'INSERT'),
  'authenticated users cannot insert earned badges'
);
select is(
  (
    select count(*)::integer
    from public.badges b
    where b.id in (
      'first-take', 'committed-bit', 'chaos-agent', 'perfectly-weird',
      'one-more-round', 'daily-five', 'daily-thirty', 'crowd-favorite',
      'friendly-fire', 'range'
    )
  ),
  10,
  'all ten deterministic milestone definitions are seeded'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '11111111-1111-4111-8111-111111111111',
  'progression-contract@example.test',
  '{"user_name":"progression_contract"}'::jsonb,
  now(),
  now()
);

select is(
  (select count(*)::integer from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  1,
  'the progression fixture has a canonical profile'
);

with fixture as (
  select p.id as prompt_id, e.id as energy_id
  from public.prompts p
  cross join public.energy_modifiers e
  where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss'
), challenge_days(day_offset) as (
  values
    (-8), (-7), (-4), (-3), (-2), (-1), (0)
)
insert into public.daily_challenges (
  challenge_date, market, prompt_id, energy_modifier_id, title
)
select
  (now() at time zone 'UTC')::date + d.day_offset,
  'pgtap-progression',
  f.prompt_id,
  f.energy_id,
  'Progression contract'
from challenge_days d
cross join fixture f;

with fixture as (
  select p.id as prompt_id, e.id as energy_id
  from public.prompts p
  cross join public.energy_modifiers e
  where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss'
), delivery_fixture(delivery_id, challenge_date, scored_at) as (
  values
    (
      '00000000-0000-4000-8000-000000001001'::uuid,
      (now() at time zone 'UTC')::date - 8,
      (((now() at time zone 'UTC')::date - 8) + time '10:00') at time zone 'UTC'
    ),
    (
      '00000000-0000-4000-8000-000000001002'::uuid,
      (now() at time zone 'UTC')::date - 8,
      (((now() at time zone 'UTC')::date - 8) + time '11:00') at time zone 'UTC'
    ),
    (
      '00000000-0000-4000-8000-000000001003'::uuid,
      (now() at time zone 'UTC')::date - 7,
      (((now() at time zone 'UTC')::date - 7) + time '10:00') at time zone 'UTC'
    ),
    (
      '00000000-0000-4000-8000-000000001004'::uuid,
      (now() at time zone 'UTC')::date - 4,
      (((now() at time zone 'UTC')::date - 4) + time '10:00') at time zone 'UTC'
    ),
    (
      '00000000-0000-4000-8000-000000001005'::uuid,
      (now() at time zone 'UTC')::date - 3,
      (((now() at time zone 'UTC')::date - 3) + time '10:00') at time zone 'UTC'
    ),
    (
      '00000000-0000-4000-8000-000000001006'::uuid,
      (now() at time zone 'UTC')::date - 2,
      (((now() at time zone 'UTC')::date - 2) + time '10:00') at time zone 'UTC'
    ),
    (
      '00000000-0000-4000-8000-000000001007'::uuid,
      (now() at time zone 'UTC')::date - 1,
      (((now() at time zone 'UTC')::date - 1) + time '10:00') at time zone 'UTC'
    ),
    (
      '00000000-0000-4000-8000-000000001008'::uuid,
      (now() at time zone 'UTC')::date,
      (((now() at time zone 'UTC')::date) + time '10:00') at time zone 'UTC'
    )
)
insert into public.deliveries (
  id, user_id, prompt_id, energy_modifier_id,
  daily_challenge_date, daily_challenge_market,
  state, visibility, recording_path, moderation_labels, scored_at
)
select
  d.delivery_id,
  '11111111-1111-4111-8111-111111111111',
  f.prompt_id,
  f.energy_id,
  d.challenge_date,
  'pgtap-progression',
  'processing',
  'private',
  '11111111-1111-4111-8111-111111111111/' || d.delivery_id::text || '.wav',
  array['publish-approved'],
  d.scored_at
from delivery_fixture d
cross join fixture f;

-- Progression consumes the durable receipt ledger. These historical fixtures are
-- inserted directly because live rank assignment intentionally accepts only the
-- current canonical global Daily.
insert into public.daily_ranked_claims (
  user_id, challenge_date, market, delivery_id, claimed_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  (now() at time zone 'UTC')::date - 8,
  'pgtap-progression',
  '00000000-0000-4000-8000-000000001001',
  (((now() at time zone 'UTC')::date - 8) + time '10:00') at time zone 'UTC'
);

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  '00000000-0000-4000-8000-000000001001',
  100, 95, 91, 90, 97,
  'Progression contract', 'First judged Daily.', 'test-v1', 'test', 'test'
);

select is(
  (select judged_deliveries from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'the first score refreshes judged-delivery totals'
);
select is(
  (select current_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'a historical Daily completion does not leave a stale current streak'
);
select is(
  (select last_daily_date from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  (now() at time zone 'UTC')::date - 8,
  'the first valid Daily completion records its UTC challenge date'
);
select is(
  (select count(*)::integer from public.user_badges where user_id = '11111111-1111-4111-8111-111111111111'),
  4,
  'the first perfect high-energy score awards four qualifying badges once'
);
select is(
  (select delivery_id from public.user_badges where user_id = '11111111-1111-4111-8111-111111111111' and badge_id = 'first-take'),
  '00000000-0000-4000-8000-000000001001'::uuid,
  'First Take keeps the deterministic earliest qualifying delivery'
);

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  '00000000-0000-4000-8000-000000001002',
  60, 60, 60, 60, 60,
  'Duplicate date', 'A second completion on the same UTC date.', 'test-v1', 'test', 'test'
);

select is(
  (select current_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'a second judged attempt on the same Daily date is idempotent for streaks'
);
select is(
  (select longest_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'a duplicate Daily date cannot inflate the longest streak'
);
select is(
  (select count(*)::integer from public.user_badges where user_id = '11111111-1111-4111-8111-111111111111' and badge_id = 'first-take'),
  1,
  'badge evaluation retries cannot duplicate an award'
);

insert into public.daily_ranked_claims (
  user_id, challenge_date, market, delivery_id, claimed_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  (now() at time zone 'UTC')::date - 7,
  'pgtap-progression',
  '00000000-0000-4000-8000-000000001003',
  (((now() at time zone 'UTC')::date - 7) + time '10:00') at time zone 'UTC'
);

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  '00000000-0000-4000-8000-000000001003',
  70, 70, 70, 70, 70,
  'Consecutive date', 'The next UTC Daily date.', 'test-v1', 'test', 'test'
);

select is(
  (select current_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'a historical consecutive run remains expired as a current streak'
);
select is(
  (select longest_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  2,
  'a consecutive UTC Daily date extends the longest streak'
);

insert into public.daily_ranked_claims (
  user_id, challenge_date, market, delivery_id, claimed_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  (now() at time zone 'UTC')::date - 4,
  'pgtap-progression',
  '00000000-0000-4000-8000-000000001004',
  (((now() at time zone 'UTC')::date - 4) + time '10:00') at time zone 'UTC'
);

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  '00000000-0000-4000-8000-000000001004',
  70, 70, 70, 70, 70,
  'Gap date', 'A Daily date after a skipped UTC day.', 'test-v1', 'test', 'test'
);

select is(
  (select current_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'the first date after a historical gap is not presented as a live streak'
);
select is(
  (select longest_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  2,
  'a gap preserves the prior longest Daily streak'
);

insert into public.daily_ranked_claims (
  user_id, challenge_date, market, delivery_id, claimed_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    (now() at time zone 'UTC')::date - 3,
    'pgtap-progression',
    '00000000-0000-4000-8000-000000001005',
    (((now() at time zone 'UTC')::date - 3) + time '10:00') at time zone 'UTC'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    (now() at time zone 'UTC')::date - 2,
    'pgtap-progression',
    '00000000-0000-4000-8000-000000001006',
    (((now() at time zone 'UTC')::date - 2) + time '10:00') at time zone 'UTC'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    (now() at time zone 'UTC')::date - 1,
    'pgtap-progression',
    '00000000-0000-4000-8000-000000001007',
    (((now() at time zone 'UTC')::date - 1) + time '10:00') at time zone 'UTC'
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    (now() at time zone 'UTC')::date,
    'pgtap-progression',
    '00000000-0000-4000-8000-000000001008',
    (((now() at time zone 'UTC')::date) + time '10:00') at time zone 'UTC'
  );

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values
  ('00000000-0000-4000-8000-000000001005', 70, 70, 70, 70, 70, 'Day two', 'Second day in the new run.', 'test-v1', 'test', 'test'),
  ('00000000-0000-4000-8000-000000001006', 70, 70, 70, 70, 70, 'Day three', 'Third day in the new run.', 'test-v1', 'test', 'test'),
  ('00000000-0000-4000-8000-000000001007', 70, 70, 70, 70, 70, 'Day four', 'Fourth day in the new run.', 'test-v1', 'test', 'test'),
  ('00000000-0000-4000-8000-000000001008', 70, 70, 70, 70, 70, 'Day five', 'Fifth day in the new run.', 'test-v1', 'test', 'test');

select is(
  (select current_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  5,
  'five consecutive UTC Daily dates produce a five-day current streak'
);
select is(
  (select longest_daily_streak from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  5,
  'the five-day run becomes the longest Daily streak'
);
select is(
  (select last_daily_date from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  (now() at time zone 'UTC')::date,
  'the latest distinct Daily date is retained'
);
select is(
  (select count(*)::integer from public.user_badges where user_id = '11111111-1111-4111-8111-111111111111' and badge_id = 'daily-five'),
  1,
  'the five-day milestone awards Appointment Player exactly once'
);
select is(
  (select delivery_id from public.user_badges where user_id = '11111111-1111-4111-8111-111111111111' and badge_id = 'daily-five'),
  '00000000-0000-4000-8000-000000001008'::uuid,
  'the streak badge points to the fifth date in the first qualifying run'
);

select lives_ok(
  $$ select public.refresh_user_rollups('11111111-1111-4111-8111-111111111111') $$,
  'an explicit retry of progression recomputation succeeds'
);
select is(
  (
    select row(current_daily_streak, longest_daily_streak, last_daily_date)::text
    from public.user_stats
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  row(5, 5, (now() at time zone 'UTC')::date)::text,
  'recomputation is idempotent for current, longest, and last-date streak state'
);
select is(
  (select count(*)::integer from public.user_badges where user_id = '11111111-1111-4111-8111-111111111111'),
  5,
  'recomputation leaves the immutable award set unchanged'
);

-- Simulate UTC time having advanced beyond the grace date without any progression
-- write. The stored snapshot may still be five; the read model must never expose it
-- as a current streak.
update public.user_stats
set current_daily_streak = 5,
    last_daily_date = (now() at time zone 'UTC')::date - 3
where user_id = '11111111-1111-4111-8111-111111111111';

select is(
  (select current_daily_streak from public.user_stats_live where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'the live stats read model expires a stale stored current streak without a write trigger'
);

select lives_ok(
  $$ select public.refresh_user_rollups('11111111-1111-4111-8111-111111111111') $$,
  'canonical recomputation restores the fixture after the time-passage simulation'
);

set local "request.jwt.claim.role" = 'service_role';
select lives_ok(
  $$
    select * from public.set_delivery_visibility(
      '00000000-0000-4000-8000-000000001001',
      'public',
      '11111111-1111-4111-8111-111111111111'
    )
  $$,
  'the trusted publish path accepts an approved complete delivery'
);
select is(
  (select public_deliveries from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  1,
  'publishing refreshes public_deliveries before returning'
);
select is(
  (
    select count(*)::integer
    from public.leaderboard_live
    where user_id = '11111111-1111-4111-8111-111111111111'
      and period = 'all_time'
      and metric = 'overall'
  ),
  0,
  'one public prompt does not qualify a player for the leaderboard'
);
select lives_ok(
  $$
    select * from public.set_delivery_visibility(
      '00000000-0000-4000-8000-000000001001',
      'private',
      '11111111-1111-4111-8111-111111111111'
    )
  $$,
  'the trusted path can unpublish the delivery'
);
select is(
  (select public_deliveries from public.user_stats where user_id = '11111111-1111-4111-8111-111111111111'),
  0,
  'unpublishing refreshes public_deliveries before returning'
);

-- Eight judged takes of the same prompt still count as only one eligible line.
do $$
declare
  target_delivery_id uuid;
begin
  for target_delivery_id in
    select d.id
    from public.deliveries d
    where d.user_id = '11111111-1111-4111-8111-111111111111'
    order by d.id
  loop
    perform public.set_delivery_visibility(
      target_delivery_id,
      'public',
      '11111111-1111-4111-8111-111111111111'
    );
  end loop;
end;
$$;

select is(
  (
    select count(*)::integer
    from public.leaderboard_live
    where user_id = '11111111-1111-4111-8111-111111111111'
      and period = 'all_time'
      and metric = 'overall'
  ),
  0,
  'repeating one line cannot farm leaderboard eligibility'
);

with prompt_choices as (
  select
    p.id as prompt_id,
    row_number() over (order by p.slug) as choice_number
  from public.prompts p
  where p.state = 'published' and p.slug <> 'timeline-needs-me'
  order by p.slug
  limit 2
), delivery_choices(choice_number, delivery_id) as (
  values
    (1::bigint, '00000000-0000-4000-8000-000000002001'::uuid),
    (2::bigint, '00000000-0000-4000-8000-000000002002'::uuid)
)
insert into public.deliveries (
  id, user_id, prompt_id, state, visibility,
  recording_path, moderation_labels, scored_at
)
select
  d.delivery_id,
  '11111111-1111-4111-8111-111111111111',
  p.prompt_id,
  'processing',
  'private',
  '11111111-1111-4111-8111-111111111111/' || d.delivery_id::text || '.wav',
  array['publish-approved'],
  now()
from prompt_choices p
join delivery_choices d on d.choice_number = p.choice_number;

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values
  ('00000000-0000-4000-8000-000000002001', 75, 75, 75, 75, 75, 'Distinct line two', 'Second eligible prompt.', 'test-v1', 'test', 'test'),
  ('00000000-0000-4000-8000-000000002002', 80, 80, 80, 80, 80, 'Distinct line three', 'Third eligible prompt.', 'test-v1', 'test', 'test');

select lives_ok(
  $test$
    do $publish$
    begin
      perform public.set_delivery_visibility(
        '00000000-0000-4000-8000-000000002001',
        'public',
        '11111111-1111-4111-8111-111111111111'
      );
      perform public.set_delivery_visibility(
        '00000000-0000-4000-8000-000000002002',
        'public',
        '11111111-1111-4111-8111-111111111111'
      );
    end;
    $publish$
  $test$,
  'two additional distinct approved prompts can be published'
);
select is(
  (
    select count(distinct d.prompt_id)::integer
    from public.deliveries d
    where d.user_id = '11111111-1111-4111-8111-111111111111'
      and d.state = 'judged'
      and d.visibility = 'public'
  ),
  3,
  'the fixture now has three distinct public judged prompts'
);
select is(
  (
    select count(*)::integer
    from public.leaderboard_live
    where user_id = '11111111-1111-4111-8111-111111111111'
      and period = 'all_time'
      and metric = 'overall'
  ),
  1,
  'three distinct public judged prompts qualify one personal best for the board'
);

select * from finish();
rollback;
