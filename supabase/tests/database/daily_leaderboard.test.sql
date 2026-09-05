begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

select has_view('public'::name, 'daily_leaderboard_live'::name);
select has_function('public'::name, 'is_canonical_daily_ranked_delivery'::name, array['uuid']);
select has_function('public'::name, 'get_daily_leaderboard_position'::name, array['text', 'text']);
select has_index('public'::name, 'deliveries'::name, 'deliveries_ranked_daily_board_idx'::name);
select ok(
  (select p.prosecdef from pg_proc p
   where p.oid = 'public.is_canonical_daily_ranked_delivery(uuid)'::regprocedure),
  'the canonical-claim predicate can inspect the private claim ledger'
);
select ok(
  not (select p.prosecdef from pg_proc p
       where p.oid = 'public.get_daily_leaderboard_position(text,text)'::regprocedure),
  'viewer rank lookup remains security invoker'
);
select ok(
  (select coalesce(c.reloptions, '{}'::text[]) @>
      array['security_invoker=true', 'security_barrier=true']::text[]
   from pg_class c where c.oid = 'public.daily_leaderboard_live'::regclass),
  'the Daily board is a security-invoker security-barrier view'
);
select ok(
  has_table_privilege('anon', 'public.daily_leaderboard_live', 'SELECT')
  and has_table_privilege('authenticated', 'public.daily_leaderboard_live', 'SELECT')
  and has_table_privilege('service_role', 'public.daily_leaderboard_live', 'SELECT'),
  'public board rows are readable by anonymous, signed-in, and trusted callers'
);
select ok(
  has_function_privilege('authenticated', 'public.get_daily_leaderboard_position(text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_daily_leaderboard_position(text,text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.get_daily_leaderboard_position(text,text)', 'EXECUTE'),
  'only an authenticated viewer can request their personal rank'
);
select ok(
  has_function_privilege('anon', 'public.is_canonical_daily_ranked_delivery(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.is_canonical_daily_ranked_delivery(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.is_canonical_daily_ranked_delivery(uuid)', 'EXECUTE'),
  'every board reader can invoke only the narrow canonical predicate'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.daily_ranked_claims', 'SELECT'),
  'the durable ranked-claim ledger itself remains hidden from clients'
);
select ok(
  position('public.daily_ranked_claims' in lower(pg_get_functiondef(
    'public.is_canonical_daily_ranked_delivery(uuid)'::regprocedure
  ))) > 0
  and position('d.energy_modifier_id' in lower(pg_get_functiondef(
    'public.is_canonical_daily_ranked_delivery(uuid)'::regprocedure
  ))) > 0
  and position('d.daily_ranked' in lower(pg_get_functiondef(
    'public.is_canonical_daily_ranked_delivery(uuid)'::regprocedure
  ))) > 0
  and position('(now() at time zone ''utc'')::date' in lower(pg_get_functiondef(
    'public.is_canonical_daily_ranked_delivery(uuid)'::regprocedure
  ))) > 0
  and position('c.market = ''global''' in lower(pg_get_functiondef(
    'public.is_canonical_daily_ranked_delivery(uuid)'::regprocedure
  ))) > 0,
  'canonical proof requires today, global, exact prompt plus energy, and the durable ranked receipt'
);
select ok(
  position('''overall''' in lower(pg_get_viewdef('public.daily_leaderboard_live'::regclass, true))) > 0
  and position('''commitment''' in lower(pg_get_viewdef('public.daily_leaderboard_live'::regclass, true))) > 0
  and position('''comedy''' in lower(pg_get_viewdef('public.daily_leaderboard_live'::regclass, true))) > 0
  and position('''chaos''' in lower(pg_get_viewdef('public.daily_leaderboard_live'::regclass, true))) > 0,
  'the canonical view expands the ranked receipt into all four supported boards'
);
select ok(
  position('auth.uid()' in lower(pg_get_functiondef(
    'public.get_daily_leaderboard_position(text,text)'::regprocedure
  ))) > 0
  and position('public.daily_leaderboard_live' in lower(pg_get_functiondef(
    'public.get_daily_leaderboard_position(text,text)'::regprocedure
  ))) > 0,
  'viewer position is selected from the exact same RLS-ranked relation'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('20202020-2020-4020-8020-202020202001', 'daily-board-one@example.test', '{"user_name":"daily_board_one","full_name":"Daily One"}'::jsonb, now(), now()),
  ('20202020-2020-4020-8020-202020202002', 'daily-board-two@example.test', '{"user_name":"daily_board_two","full_name":"Daily Two"}'::jsonb, now(), now()),
  ('20202020-2020-4020-8020-202020202003', 'daily-board-private@example.test', '{"user_name":"daily_board_private","full_name":"Daily Private"}'::jsonb, now(), now());

select is(
  (select count(*)::integer from public.profiles
   where id between '20202020-2020-4020-8020-202020202001'
     and '20202020-2020-4020-8020-202020202003'),
  3,
  'the Daily board fixtures create all profiles'
);

with today as (
  select dc.challenge_date, dc.market, dc.prompt_id, dc.energy_modifier_id
  from public.daily_challenges dc
  where dc.challenge_date = (now() at time zone 'UTC')::date
    and dc.market = 'global'
)
insert into public.deliveries (
  id, user_id, prompt_id, energy_modifier_id,
  daily_challenge_date, daily_challenge_market,
  state, visibility, recording_path, moderation_labels, scored_at
)
select
  fixture.delivery_id,
  fixture.user_id,
  today.prompt_id,
  today.energy_modifier_id,
  today.challenge_date,
  today.market,
  'processing',
  'private',
  fixture.user_id::text || '/' || fixture.delivery_id::text || '.wav',
  array['publish-approved'],
  now() - fixture.age
from (
  values
    ('21212121-2121-4121-8121-212121212101'::uuid, '20202020-2020-4020-8020-202020202001'::uuid, interval '4 minutes'),
    ('21212121-2121-4121-8121-212121212102'::uuid, '20202020-2020-4020-8020-202020202002'::uuid, interval '3 minutes'),
    ('21212121-2121-4121-8121-212121212103'::uuid, '20202020-2020-4020-8020-202020202003'::uuid, interval '2 minutes'),
    ('21212121-2121-4121-8121-212121212104'::uuid, '20202020-2020-4020-8020-202020202002'::uuid, interval '1 minute')
) as fixture(delivery_id, user_id, age)
cross join today;

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values
  ('21212121-2121-4121-8121-212121212101', 90, 80, 91, 82, 99, 'One went feral', 'Daily One found the chaos board.', 'test-v1', 'test', 'test'),
  ('21212121-2121-4121-8121-212121212102', 90, 95, 88, 93, 60, 'Two committed', 'Daily Two wins the overall tie on commitment.', 'test-v1', 'test', 'test'),
  ('21212121-2121-4121-8121-212121212103', 99, 99, 99, 99, 99, 'Private perfection', 'A private profile never enters the board.', 'test-v1', 'test', 'test');

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  '21212121-2121-4121-8121-212121212104',
  100, 100, 100, 100, 100,
  'Practice perfection', 'A later take persists but cannot replace the receipt.',
  'test-v1', 'test', 'test'
);

select is(
  (select string_agg(d.id::text || ':' || d.daily_ranked::text, ',' order by d.id)
   from public.deliveries d
   where d.id between '21212121-2121-4121-8121-212121212101'
     and '21212121-2121-4121-8121-212121212104'),
  '21212121-2121-4121-8121-212121212101:true,21212121-2121-4121-8121-212121212102:true,21212121-2121-4121-8121-212121212103:true,21212121-2121-4121-8121-212121212104:false',
  'each first score owns the receipt while the second take is practice'
);
select is(
  (select count(*)::integer from public.daily_ranked_claims c
   where c.user_id between '20202020-2020-4020-8020-202020202001'
     and '20202020-2020-4020-8020-202020202003'
     and c.challenge_date = (now() at time zone 'UTC')::date
     and c.market = 'global'),
  3,
  'the durable ledger has exactly one current global claim per fixture player'
);

set local "request.jwt.claim.role" = 'service_role';
do $$
begin
  perform * from public.set_delivery_visibility('21212121-2121-4121-8121-212121212101', 'public', '20202020-2020-4020-8020-202020202001');
  perform * from public.set_delivery_visibility('21212121-2121-4121-8121-212121212102', 'public', '20202020-2020-4020-8020-202020202002');
  perform * from public.set_delivery_visibility('21212121-2121-4121-8121-212121212103', 'public', '20202020-2020-4020-8020-202020202003');
  perform * from public.set_delivery_visibility('21212121-2121-4121-8121-212121212104', 'public', '20202020-2020-4020-8020-202020202002');
end;
$$;

update public.profiles set is_private = true
where id = '20202020-2020-4020-8020-202020202003';

set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '20202020-2020-4020-8020-202020202001';

select is(
  (select count(*)::integer from public.daily_leaderboard_live),
  8,
  'two eligible receipts expand into four metric rows each'
);
select ok(
  not exists (
    select 1 from public.daily_leaderboard_live
    where delivery_id = '21212121-2121-4121-8121-212121212104'
       or user_id = '20202020-2020-4020-8020-202020202003'
  ),
  'practice takes and private profiles are excluded from every board'
);
select is(
  (select string_agg(handle || ':' || rank::text || ':' || score::integer::text, ',' order by rank)
   from public.daily_leaderboard_live where metric = 'overall'),
  'daily_board_two:1:90,daily_board_one:2:90',
  'overall ties break on commitment before the immutable receipt timestamp'
);
select is(
  (select string_agg(handle || ':' || rank::text || ':' || score::integer::text, ',' order by rank)
   from public.daily_leaderboard_live where metric = 'chaos'),
  'daily_board_one:1:99,daily_board_two:2:60',
  'each axis board ranks by its own score'
);
select ok(
  not exists (
    select 1 from public.daily_leaderboard_live
    where participant_count <> 2
       or challenge_date <> (now() at time zone 'UTC')::date
       or market <> 'global'
  ),
  'every row reports the current global two-player field'
);
select is(
  (select row(rank, participant_count)::text
   from public.get_daily_leaderboard_position('overall', 'global')),
  row(2::integer, 2::integer)::text,
  'the viewer gets their overall rank even outside an API top-N slice'
);
select is(
  (select row(rank, participant_count)::text
   from public.get_daily_leaderboard_position('chaos', 'global')),
  row(1::integer, 2::integer)::text,
  'the same viewer has an independent axis rank'
);
select throws_ok(
  $$ select * from public.get_daily_leaderboard_position('accuracy', 'global') $$,
  '22023',
  'Unknown Daily leaderboard metric',
  'unsupported metrics fail closed'
);
select throws_ok(
  $$ select * from public.get_daily_leaderboard_position('overall', 'local') $$,
  '22023',
  'Only the global Daily leaderboard is available',
  'noncanonical markets fail closed'
);

insert into public.blocks (blocker_id, blocked_id)
values ('20202020-2020-4020-8020-202020202001', '20202020-2020-4020-8020-202020202002');

select ok(
  (select count(*) = 4
     and min(rank) = 1
     and max(rank) = 1
     and min(participant_count) = 1
     and max(participant_count) = 1
   from public.daily_leaderboard_live)
  and (select rank = 1 and participant_count = 1
       from public.get_daily_leaderboard_position('overall', 'global')),
  'a block removes the counterpart and renumbers every viewer-scoped board without leakage'
);

update public.deliveries
set visibility = 'private', moderation_labels = array['publish-approved', 'publish-limited']
where id = '21212121-2121-4121-8121-212121212101';

select ok(
  not exists (select 1 from public.daily_leaderboard_live)
  and not exists (
    select 1 from public.get_daily_leaderboard_position('overall', 'global')
  ),
  'moderation containment removes the viewer receipt from board and position lookup'
);

select * from finish();
rollback;
