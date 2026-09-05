begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(49);

select has_column('public'::name, 'deliveries'::name, 'daily_ranked'::name, 'deliveries.daily_ranked exists');
select has_table('public'::name, 'daily_ranked_claims'::name);
select col_default_is('public'::name, 'deliveries'::name, 'daily_ranked'::name, 'false', 'column default remains compatible');
select col_not_null('public'::name, 'deliveries'::name, 'daily_ranked'::name);
select has_trigger('public'::name, 'deliveries'::name, 'deliveries_initialize_daily_rank'::name);
select has_trigger('public'::name, 'delivery_scores'::name, 'delivery_scores_assign_daily_rank'::name);
select has_function('public'::name, 'assign_daily_rank_before_score'::name, array[]::text[]);
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.assign_daily_rank_before_score()'::regprocedure),
  'Daily rank assignment runs as a trusted trigger function'
);
select ok(
  not has_function_privilege('authenticated', 'public.assign_daily_rank_before_score()', 'EXECUTE'),
  'authenticated clients cannot invoke Daily rank assignment'
);
select ok(
  not has_function_privilege('service_role', 'public.assign_daily_rank_before_score()', 'EXECUTE'),
  'the service API cannot bypass the score trigger to assign Daily rank'
);
select ok(
  not has_column_privilege('authenticated', 'public.deliveries', 'daily_ranked', 'INSERT'),
  'authenticated clients cannot nominate a delivery as ranked on insert'
);
select ok(
  not has_column_privilege('authenticated', 'public.deliveries', 'daily_ranked', 'UPDATE'),
  'authenticated clients cannot rewrite ranked-versus-practice state'
);
select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.daily_ranked_claims'::regclass),
  'the durable ranked-claim ledger has RLS enabled'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.daily_ranked_claims', 'SELECT')
  and not has_any_column_privilege('authenticated', 'public.daily_ranked_claims', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.daily_ranked_claims', 'UPDATE'),
  'authenticated clients cannot inspect or mutate the internal ranked-claim ledger'
);
select ok(
  (
    select i.indisunique and i.indpred is not null
    from pg_index i
    where i.indexrelid = 'public.deliveries_one_ranked_daily_idx'::regclass
  ),
  'a partial unique index defends one ranked result per player/date/market'
);
select ok(
  position(
    'pg_advisory_xact_lock' in pg_get_functiondef('public.assign_daily_rank_before_score()'::regprocedure)
  ) > 0,
  'competing score inserts serialize on the player/date/market rank slot'
);
select ok(
  position(
    'daily_ranked_claims' in pg_get_functiondef('public.refresh_user_rollups(uuid)'::regprocedure)
  ) > 0,
  'Daily streak rollups use the durable ranked-claim ledger'
);
select ok(
  position(
    'daily_ranked_claims' in pg_get_functiondef('public.award_progression_badges(uuid)'::regprocedure)
  ) > 0,
  'Daily badge milestones use the durable ranked-claim ledger'
);
select ok(
  position(
    'select distinct on (c.challenge_date)' in
      lower(pg_get_functiondef('public.award_progression_badges(uuid)'::regprocedure))
  ) > 0,
  'Daily badge runs collapse legacy multi-market claims to one UTC date'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.deliveries', 'INSERT'),
  'authenticated clients cannot bypass the judge route with direct delivery inserts'
);
select ok(
  not has_table_privilege('authenticated', 'public.deliveries', 'DELETE'),
  'authenticated clients cannot bypass media cleanup with direct delivery deletes'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deliveries'
      and policyname in ('users create own deliveries', 'users delete own deliveries')
  ),
  0,
  'direct delivery mutation policies are removed'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'owners upload recordings'
  ),
  0,
  'direct delivery-audio uploads cannot bypass the validated judge route'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.line_submissions', 'INSERT'),
  'authenticated clients cannot bypass submission moderation with direct table inserts'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.user_submissions', 'INSERT'),
  'the compatibility submission view cannot bypass the validated API'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'line_submissions'
      and policyname = 'users submit lines'
  ),
  0,
  'the direct line-submission insert policy is removed'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.reports', 'INSERT'),
  'authenticated clients cannot bypass report validation and rate limits'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reports'
      and policyname = 'users create reports'
  ),
  0,
  'the direct report insert policy is removed'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '33333333-3333-4333-8333-333333333333',
  'ranked-daily@example.test',
  '{"user_name":"ranked_daily"}'::jsonb,
  now(), now()
);

select is(
  (select count(*)::integer from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  1,
  'the ranked Daily fixture has a canonical profile'
);

insert into public.daily_challenges (
  challenge_date, market, prompt_id, energy_modifier_id, title
)
select
  dc.challenge_date,
  'pgtap-ranked',
  dc.prompt_id,
  dc.energy_modifier_id,
  'Non-global validation fixture'
from public.daily_challenges dc
where dc.challenge_date = (now() at time zone 'UTC')::date
  and dc.market = 'global';

with delivery_fixture(delivery_id, challenge_date, challenge_market, wrong_energy) as (
  values
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee001'::uuid,
      (now() at time zone 'UTC')::date,
      'global'::text,
      false
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee002'::uuid,
      (now() at time zone 'UTC')::date,
      'global'::text,
      false
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee004'::uuid,
      (now() at time zone 'UTC')::date,
      'global'::text,
      false
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee005'::uuid,
      (now() at time zone 'UTC')::date,
      'global'::text,
      false
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee006'::uuid,
      (now() at time zone 'UTC')::date + 1,
      'global'::text,
      false
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee007'::uuid,
      (now() at time zone 'UTC')::date,
      'pgtap-ranked'::text,
      false
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee008'::uuid,
      (now() at time zone 'UTC')::date,
      'global'::text,
      true
    )
)
insert into public.deliveries (
  id, user_id, prompt_id, energy_modifier_id,
  daily_challenge_date, daily_challenge_market,
  state, visibility, recording_path
)
select
  d.delivery_id,
  '33333333-3333-4333-8333-333333333333',
  dc.prompt_id,
  case when d.wrong_energy then alternate_energy.id else dc.energy_modifier_id end,
  d.challenge_date,
  d.challenge_market,
  'processing',
  'private',
  '33333333-3333-4333-8333-333333333333/' || d.delivery_id::text || '.wav'
from delivery_fixture d
join public.daily_challenges dc
  on dc.challenge_date = d.challenge_date and dc.market = d.challenge_market
cross join lateral (
  select e.id
  from public.energy_modifiers e
  where e.id <> dc.energy_modifier_id
  order by e.slug
  limit 1
) alternate_energy;

insert into public.deliveries (
  id, user_id, prompt_id, energy_modifier_id,
  state, visibility, recording_path
)
select
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeee003',
  '33333333-3333-4333-8333-333333333333',
  dc.prompt_id,
  dc.energy_modifier_id,
  'processing',
  'private',
  '33333333-3333-4333-8333-333333333333/eeeeeeee-eeee-4eee-8eee-eeeeeeeee003.wav'
from public.daily_challenges dc
where dc.challenge_date = (now() at time zone 'UTC')::date
  and dc.market = 'global';

select is(
  (
    select count(*)::integer
    from public.deliveries
    where user_id = '33333333-3333-4333-8333-333333333333' and daily_ranked
  ),
  0,
  'processing deliveries cannot reserve a ranked Daily slot'
);

-- Prove the rank reservation is transactional before allowing a successful score.
create or replace function pg_temp.reject_forced_score()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider = 'force-fail' then
    raise exception using errcode = 'P0001', message = 'Forced score persistence failure';
  end if;
  return new;
end;
$$;

create trigger zz_pgtap_reject_forced_score
  after insert on public.delivery_scores
  for each row execute function pg_temp.reject_forced_score();

select throws_ok(
  $$
    insert into public.delivery_scores (
      delivery_id, overall, commitment, comedy, accuracy, chaos,
      headline, verdict, rubric_version, provider, model
    )
    values (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee004',
      75, 75, 75, 75, 75,
      'Rolled back', 'This score never persists.', 'test-v1', 'force-fail', 'test'
    )
  $$,
  'P0001',
  'Forced score persistence failure',
  'a downstream score failure rolls back its provisional rank assignment'
);
select is(
  (select count(*)::integer from public.delivery_scores where delivery_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee004'),
  0,
  'the forced provider score is absent after rollback'
);
select ok(
  not (select daily_ranked from public.deliveries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee004'),
  'the failed score did not strand a ranked Daily slot'
);
select is(
  (
    select count(*)::integer
    from public.daily_ranked_claims
    where user_id = '33333333-3333-4333-8333-333333333333'
  ),
  0,
  'the failed score rolls back its provisional durable claim'
);

-- Score the second-created take first: successful score persistence, not delivery
-- creation order, owns the ranked result.
insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeee002',
  82, 82, 82, 82, 82,
  'Ranked result', 'First durable score wins the rank slot.', 'test-v1', 'test', 'test'
);

select ok(
  (select daily_ranked from public.deliveries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee002'),
  'the first successfully scored Daily take becomes ranked'
);
select is(
  (
    select delivery_id
    from public.daily_ranked_claims
    where user_id = '33333333-3333-4333-8333-333333333333'
      and challenge_date = (now() at time zone 'UTC')::date
      and market = 'global'
  ),
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeee002'::uuid,
  'the ranked result is durably recorded in the independent claim ledger'
);

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeee001',
  99, 99, 99, 99, 99,
  'Practice result', 'A later higher score stays practice.', 'test-v1', 'test', 'test'
);

select is(
  (
    select count(*)::integer
    from public.deliveries
    where user_id = '33333333-3333-4333-8333-333333333333'
      and daily_challenge_date = (now() at time zone 'UTC')::date
      and daily_challenge_market = 'global'
      and daily_ranked
  ),
  1,
  'two judged takes still produce exactly one ranked Daily result'
);
select ok(
  not (select daily_ranked from public.deliveries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee001'),
  'the later scored take persists as practice even with a higher score'
);
select is(
  (
    select delivery_id
    from public.daily_ranked_claims
    where user_id = '33333333-3333-4333-8333-333333333333'
      and challenge_date = (now() at time zone 'UTC')::date
      and market = 'global'
  ),
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeee002'::uuid,
  'a practice score cannot replace the original ranked receipt'
);

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeee003',
  70, 70, 70, 70, 70,
  'Classic result', 'Non-Daily deliveries are never ranked Daily.', 'test-v1', 'test', 'test'
);

select ok(
  not (select daily_ranked from public.deliveries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee003'),
  'a non-Daily judged delivery is forced to daily_ranked false'
);

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeee006',
    71, 71, 71, 71, 71,
    'Future date', 'A forged future Daily stays practice.', 'test-v1', 'test', 'test'
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeee007',
    72, 72, 72, 72, 72,
    'Other market', 'A non-global Daily stays practice.', 'test-v1', 'test', 'test'
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeee008',
    73, 73, 73, 73, 73,
    'Wrong energy', 'A mismatched Daily energy stays practice.', 'test-v1', 'test', 'test'
  );

select ok(
  not (select daily_ranked from public.deliveries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee006'),
  'a future Daily row cannot become ranked'
);
select ok(
  not (select daily_ranked from public.deliveries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee007'),
  'a non-global Daily row cannot become ranked'
);
select ok(
  not (select daily_ranked from public.deliveries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee008'),
  'a Daily row with the wrong energy cannot become ranked'
);
select is(
  (
    select count(*)::integer
    from public.daily_ranked_claims
    where user_id = '33333333-3333-4333-8333-333333333333'
  ),
  1,
  'noncanonical scored rows cannot mint additional ranked claims'
);

select throws_ok(
  $$
    update public.deliveries
    set daily_ranked = true
    where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee001'
  $$,
  '23505',
  'duplicate key value violates unique constraint "deliveries_one_ranked_daily_idx"',
  'the unique invariant blocks a second ranked result even for trusted writes'
);

delete from public.deliveries
where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee002';

select ok(
  (
    select delivery_id is null
    from public.daily_ranked_claims
    where user_id = '33333333-3333-4333-8333-333333333333'
      and challenge_date = (now() at time zone 'UTC')::date
      and market = 'global'
  ),
  'deleting the ranked recording leaves an immutable tombstoned claim'
);

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeee005',
  100, 100, 100, 100, 100,
  'Deletion reroll', 'Still practice after ranked audio deletion.', 'test-v1', 'test', 'test'
);

select ok(
  not (select daily_ranked from public.deliveries where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee005'),
  'a post-deletion perfect take remains practice'
);
select is(
  (
    select count(*)::integer
    from public.daily_ranked_claims
    where user_id = '33333333-3333-4333-8333-333333333333'
      and challenge_date = (now() at time zone 'UTC')::date
      and market = 'global'
  ),
  1,
  'deletion and resubmission cannot create a second ranked claim'
);
select is(
  (select current_daily_streak from public.user_stats where user_id = '33333333-3333-4333-8333-333333333333'),
  1,
  'the durable Daily completion continues to support streak history after recording deletion'
);

select * from finish();
rollback;
