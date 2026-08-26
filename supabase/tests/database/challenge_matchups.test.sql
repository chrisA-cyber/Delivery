begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

select has_function('public', 'get_challenge_by_invite', array['text', 'text']);
select has_function('public', 'validate_challenge_entry', array[]::text[]);
select ok(
  position('c.state in (''open'', ''accepted'', ''completed'')' in lower(pg_get_functiondef('public.get_challenge_by_invite(text,text)'::regprocedure))) > 0,
  'signed invites remain readable as completed matchup receipts until expiry'
);
select ok(
  position('set recipient_user_id = new.entrant_id' in lower(pg_get_functiondef('public.validate_challenge_entry()'::regprocedure))) > 0,
  'the trusted entry trigger binds the first non-creator entrant as recipient'
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.get_challenge_by_invite(text,text)'::regprocedure),
  'signed invite lookup is security definer'
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.validate_challenge_entry()'::regprocedure),
  'challenge admission trigger is security definer'
);
select ok(has_function_privilege('anon', 'public.get_challenge_by_invite(text,text)', 'EXECUTE'), 'anonymous invite holders may resolve a signed challenge');
select ok(has_function_privilege('authenticated', 'public.get_challenge_by_invite(text,text)', 'EXECUTE'), 'signed-in invite holders may resolve a signed challenge');
select ok(not has_function_privilege('authenticated', 'public.validate_challenge_entry()', 'EXECUTE'), 'clients cannot invoke recipient binding directly');
select ok(
  not has_column_privilege('authenticated', 'public.challenges', 'recipient_user_id', 'UPDATE'),
  'signed-in creators cannot swap the bound rival directly'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.challenges', 'INSERT'),
  'authenticated clients cannot bypass Pro checks, rate limits, or token generation with direct challenge inserts'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.challenges', 'UPDATE'),
  'authenticated clients cannot rewrite derived challenge state or invite settings'
);
select ok(
  not has_table_privilege('authenticated', 'public.challenges', 'DELETE'),
  'authenticated clients cannot bypass challenge lifecycle cleanup with direct deletes'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '22222222-2222-4222-8222-222222222221',
    'matchup-creator@example.test',
    '{"user_name":"matchup_creator"}'::jsonb,
    now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'matchup-rival@example.test',
    '{"user_name":"matchup_rival"}'::jsonb,
    now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222223',
    'matchup-intruder@example.test',
    '{"user_name":"matchup_intruder"}'::jsonb,
    now(), now()
  );

select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '22222222-2222-4222-8222-222222222221',
      '22222222-2222-4222-8222-222222222222',
      '22222222-2222-4222-8222-222222222223'
    )
  ),
  3,
  'the challenge fixture has creator, rival, and third-user profiles'
);

with content as (
  select p.id as prompt_id, e.id as energy_id
  from public.prompts p
  cross join public.energy_modifiers e
  where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss'
), challenge_fixture(challenge_id, code, token, max_entries) as (
  values
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid,
      'MATCHA001',
      'match-a-receipt-token',
      2::smallint
    ),
    (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid,
      'MATCHB002',
      'match-b-binding-token',
      3::smallint
    )
)
insert into public.challenges (
  id, code, token_digest, created_by, prompt_id, energy_modifier_id,
  state, visibility, max_entries, expires_at
)
select
  c.challenge_id,
  c.code,
  extensions.digest(convert_to(c.token, 'UTF8'), 'sha256'),
  '22222222-2222-4222-8222-222222222221',
  content.prompt_id,
  content.energy_id,
  'open',
  'link',
  c.max_entries,
  now() + interval '7 days'
from challenge_fixture c
cross join content;

select is(
  (
    select state
    from public.get_challenge_by_invite('MATCHA001', 'match-a-receipt-token')
  ),
  'open'::public.challenge_state,
  'a valid signed invite resolves while the challenge is open'
);

with content as (
  select p.id as prompt_id, e.id as energy_id
  from public.prompts p
  cross join public.energy_modifiers e
  where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss'
), delivery_fixture(delivery_id, user_id, challenge_id) as (
  values
    (
      'cccccccc-cccc-4ccc-8ccc-ccccccccc101'::uuid,
      '22222222-2222-4222-8222-222222222221'::uuid,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid
    ),
    (
      'cccccccc-cccc-4ccc-8ccc-ccccccccc102'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid
    ),
    (
      'cccccccc-cccc-4ccc-8ccc-ccccccccc103'::uuid,
      '22222222-2222-4222-8222-222222222223'::uuid,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'::uuid
    ),
    (
      'dddddddd-dddd-4ddd-8ddd-ddddddddd102'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
    ),
    (
      'dddddddd-dddd-4ddd-8ddd-ddddddddd103'::uuid,
      '22222222-2222-4222-8222-222222222223'::uuid,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'::uuid
    )
)
insert into public.deliveries (
  id, user_id, prompt_id, energy_modifier_id, challenge_id,
  state, visibility, recording_path
)
select
  d.delivery_id,
  d.user_id,
  content.prompt_id,
  content.energy_id,
  d.challenge_id,
  'processing',
  'private',
  d.user_id::text || '/' || d.delivery_id::text || '.wav'
from delivery_fixture d
cross join content;

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc101', 80, 80, 80, 80, 80, 'Creator', 'Creator entry.', 'test-v1', 'test', 'test'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc102', 81, 81, 81, 81, 81, 'Rival', 'Rival entry.', 'test-v1', 'test', 'test'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccc103', 82, 82, 82, 82, 82, 'Third user', 'Rejected completed entry.', 'test-v1', 'test', 'test'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd102', 83, 83, 83, 83, 83, 'First rival', 'Binds the open slot.', 'test-v1', 'test', 'test'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd103', 84, 84, 84, 84, 84, 'Other rival', 'Cannot steal the slot.', 'test-v1', 'test', 'test');

insert into public.challenge_entries (challenge_id, delivery_id, entrant_id)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001',
  'cccccccc-cccc-4ccc-8ccc-ccccccccc101',
  '22222222-2222-4222-8222-222222222221'
);

select ok(
  (select recipient_user_id is null from public.challenges where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'),
  'a creator entry never binds the recipient slot'
);
select is(
  (select state from public.challenges where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'),
  'accepted'::public.challenge_state,
  'one creator entry leaves the matchup accepted and waiting'
);
select is(
  (
    select state
    from public.get_challenge_by_invite('MATCHA001', 'match-a-receipt-token')
  ),
  'accepted'::public.challenge_state,
  'the signed invite resolves while waiting for its rival'
);

insert into public.challenge_entries (challenge_id, delivery_id, entrant_id)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001',
  'cccccccc-cccc-4ccc-8ccc-ccccccccc102',
  '22222222-2222-4222-8222-222222222222'
);

select is(
  (select recipient_user_id from public.challenges where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'the first non-creator entry atomically binds the rival as recipient'
);
select is(
  (select state from public.challenges where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'),
  'completed'::public.challenge_state,
  'creator plus bound rival completes a two-entry matchup'
);
select ok(
  (select completed_at is not null from public.challenges where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001'),
  'completion records its timestamp'
);
select is(
  (
    select state
    from public.get_challenge_by_invite('MATCHA001', 'match-a-receipt-token')
  ),
  'completed'::public.challenge_state,
  'the same signed invite resolves the completed matchup receipt'
);
select throws_ok(
  $$
    insert into public.challenge_entries (challenge_id, delivery_id, entrant_id)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa001',
      'cccccccc-cccc-4ccc-8ccc-ccccccccc103',
      '22222222-2222-4222-8222-222222222223'
    )
  $$,
  'P0001',
  'Challenge is no longer accepting entries',
  'completed challenges remain closed to judging entries'
);

insert into public.challenge_entries (challenge_id, delivery_id, entrant_id)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
  'dddddddd-dddd-4ddd-8ddd-ddddddddd102',
  '22222222-2222-4222-8222-222222222222'
);

select is(
  (select recipient_user_id from public.challenges where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'the first rival can bind before the creator submits'
);
select is(
  (select state from public.challenges where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002'),
  'accepted'::public.challenge_state,
  'a rival-first matchup waits for its creator'
);
select throws_ok(
  $$
    insert into public.challenge_entries (challenge_id, delivery_id, entrant_id)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb002',
      'dddddddd-dddd-4ddd-8ddd-ddddddddd103',
      '22222222-2222-4222-8222-222222222223'
    )
  $$,
  'P0001',
  'Entrant is not invited to this challenge',
  'a different signed-in user cannot steal an already-bound rival slot'
);

select * from finish();
rollback;
