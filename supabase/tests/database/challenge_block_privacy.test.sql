begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(33);

select has_function('public', 'can_view_challenge', array['uuid']);
select has_function('public', 'get_challenge_by_invite', array['text', 'text']);
select has_function('public', 'validate_challenge_entry', array[]::text[]);
select has_trigger('public', 'blocks', 'blocks_remove_follows');
select ok(
  (select p.prosecdef from pg_proc p where p.oid = 'public.can_view_challenge(uuid)'::regprocedure),
  'challenge RLS visibility uses a security-definer gate'
);
select ok(
  has_function_privilege('authenticated', 'public.can_view_challenge(uuid)', 'EXECUTE'),
  'authenticated challenge reads can invoke the RLS gate'
);
select ok(
  has_function_privilege('anon', 'public.can_view_challenge(uuid)', 'EXECUTE'),
  'anonymous public-challenge reads can invoke the RLS gate'
);
select ok(
  position(
    'public.account_deletion_jobs' in lower(pg_get_functiondef(
      'public.get_challenge_by_invite(text,text)'::regprocedure
    ))
  ) > 0,
  'the final invite resolver preserves account-deletion containment'
);
select ok(
  position(
    'public.blocks' in lower(pg_get_functiondef(
      'public.get_challenge_by_invite(text,text)'::regprocedure
    ))
  ) > 0,
  'signed invite resolution checks symmetric blocks'
);
select ok(
  position(
    'public.blocks' in lower(pg_get_functiondef(
      'public.validate_challenge_entry()'::regprocedure
    ))
  ) > 0,
  'challenge admission checks symmetric blocks'
);
select ok(
  position(
    'token_digest = null' in lower(pg_get_functiondef(
      'public.remove_follows_on_block()'::regprocedure
    ))
  ) > 0,
  'the block cascade permanently revokes signed invite tokens'
);
select ok(
  (
    select position('can_view_challenge(id)' in lower(qual)) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'challenges'
      and policyname = 'challenge participants can read'
  ),
  'challenge-row RLS uses the block-aware visibility gate'
);
select ok(
  (
    select position('can_view_challenge(challenge_id)' in lower(qual)) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'challenge_entries'
      and policyname = 'challenge entries visible to participants'
  ),
  'challenge-entry RLS uses the same block-aware visibility gate'
);
select ok(
  not has_function_privilege('authenticated', 'public.validate_challenge_entry()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.remove_follows_on_block()', 'EXECUTE'),
  'challenge/block mutation triggers remain internal'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('12121212-1212-4212-8212-121212121201', 'block-challenge-creator@example.test', '{"user_name":"block_challenge_creator"}'::jsonb, now(), now()),
  ('12121212-1212-4212-8212-121212121202', 'block-challenge-rival@example.test', '{"user_name":"block_challenge_rival"}'::jsonb, now(), now()),
  ('12121212-1212-4212-8212-121212121203', 'block-challenge-viewer@example.test', '{"user_name":"block_challenge_viewer"}'::jsonb, now(), now());

select is(
  (select count(*)::integer from public.profiles where id between '12121212-1212-4212-8212-121212121201' and '12121212-1212-4212-8212-121212121203'),
  3,
  'challenge privacy fixtures create all three profiles'
);

with content as (
  select p.id as prompt_id, e.id as energy_id
  from public.prompts p
  cross join public.energy_modifiers e
  where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss'
), fixtures(challenge_id, code, token, challenge_state, completed_at, message, recipient_user_id) as (
  values
    ('13131313-1313-4313-8313-131313131301'::uuid, 'BLOCKA01'::text, 'block-open-receipt-token'::text, 'open'::public.challenge_state, null::timestamptz, 'Open invite copy.'::text, '12121212-1212-4212-8212-121212121202'::uuid),
    ('13131313-1313-4313-8313-131313131302'::uuid, 'BLOCKC02'::text, 'block-complete-receipt-token'::text, 'completed'::public.challenge_state, now(), 'Completed receipt copy.'::text, '12121212-1212-4212-8212-121212121202'::uuid),
    ('13131313-1313-4313-8313-131313131303'::uuid, 'BLOCKN03'::text, 'post-block-trusted-token'::text, 'open'::public.challenge_state, null::timestamptz, 'Unbound invite copy.'::text, null::uuid)
)
insert into public.challenges (
  id, code, token_digest, created_by, recipient_user_id,
  prompt_id, energy_modifier_id, state, visibility, message,
  max_entries, expires_at, completed_at
)
select
  f.challenge_id,
  f.code,
  extensions.digest(pg_catalog.convert_to(f.token, 'UTF8'), 'sha256'),
  '12121212-1212-4212-8212-121212121201',
  f.recipient_user_id,
  c.prompt_id,
  c.energy_id,
  f.challenge_state,
  'link',
  f.message,
  2,
  now() + interval '7 days',
  f.completed_at
from fixtures f
cross join content c;

set local "request.jwt.claim.sub" = '12121212-1212-4212-8212-121212121202';

select is(
  (select state from public.get_challenge_by_invite('BLOCKA01', 'block-open-receipt-token')),
  'open'::public.challenge_state,
  'a bound open invite resolves before either participant blocks'
);
select is(
  (select state from public.get_challenge_by_invite('BLOCKC02', 'block-complete-receipt-token')),
  'completed'::public.challenge_state,
  'a bound completed receipt resolves before either participant blocks'
);
select ok(
  public.can_view_challenge('13131313-1313-4313-8313-131313131301'),
  'the recipient can read the unblocked challenge through RLS'
);

insert into public.follows (follower_id, following_id)
values
  ('12121212-1212-4212-8212-121212121201', '12121212-1212-4212-8212-121212121202'),
  ('12121212-1212-4212-8212-121212121202', '12121212-1212-4212-8212-121212121201');

select is(
  (select count(*)::integer from public.follows where follower_id in ('12121212-1212-4212-8212-121212121201', '12121212-1212-4212-8212-121212121202') and following_id in ('12121212-1212-4212-8212-121212121201', '12121212-1212-4212-8212-121212121202')),
  2,
  'the pair begins with both follow edges'
);

insert into public.blocks (blocker_id, blocked_id)
values ('12121212-1212-4212-8212-121212121201', '12121212-1212-4212-8212-121212121202');

select ok(
  (select c.state = 'canceled' and c.visibility = 'private'
     and c.token_digest is null and c.message is null
     and c.expires_at <= now() and c.completed_at is null
   from public.challenges c where c.id = '13131313-1313-4313-8313-131313131301'),
  'blocking cancels and redacts the active bound challenge'
);
select ok(
  (select c.state = 'completed' and c.visibility = 'private'
     and c.token_digest is null and c.message is null and c.completed_at is not null
   from public.challenges c where c.id = '13131313-1313-4313-8313-131313131302'),
  'blocking preserves completed audit state while revoking its receipt and copy'
);
select is(
  (select count(*)::integer from public.get_challenge_by_invite('BLOCKA01', 'block-open-receipt-token')),
  0,
  'the canceled active invite is no longer resolvable'
);
select is(
  (select count(*)::integer from public.get_challenge_by_invite('BLOCKC02', 'block-complete-receipt-token')),
  0,
  'the completed signed receipt is no longer resolvable'
);
select ok(
  not public.can_view_challenge('13131313-1313-4313-8313-131313131302'),
  'participant RLS denies even a completed matchup after blocking'
);
select is(
  (select count(*)::integer from public.follows where follower_id in ('12121212-1212-4212-8212-121212121201', '12121212-1212-4212-8212-121212121202') and following_id in ('12121212-1212-4212-8212-121212121201', '12121212-1212-4212-8212-121212121202')),
  0,
  'the same atomic block cascade severs both follow edges'
);

select throws_ok(
  $$ insert into public.follows (follower_id, following_id)
     values (
       '12121212-1212-4212-8212-121212121202',
       '12121212-1212-4212-8212-121212121201'
     ) $$,
  '55000',
  'Interaction is unavailable between blocked users',
  'a stale follow write cannot commit after the block cleanup'
);

select throws_ok(
  $$ insert into public.challenges (
       id, code, token_digest, created_by, recipient_user_id,
       prompt_id, energy_modifier_id, state, visibility, max_entries, expires_at
     )
     select
       '13131313-1313-4313-8313-131313131304',
       'BLOCKB04',
       extensions.digest(pg_catalog.convert_to('blocked-bound-token', 'UTF8'), 'sha256'),
       '12121212-1212-4212-8212-121212121201',
       '12121212-1212-4212-8212-121212121202',
       p.id,
       e.id,
       'open',
       'link',
       2,
       now() + interval '7 days'
     from public.prompts p
     cross join public.energy_modifiers e
     where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss' $$,
  '55000',
  'Interaction is unavailable between blocked users',
  'a stale trusted challenge create cannot bind a blocked pair'
);

insert into public.deliveries (
  id, user_id, prompt_id, energy_modifier_id, challenge_id,
  state, visibility, recording_path
)
select
  '14141414-1414-4414-8414-141414141401',
  '12121212-1212-4212-8212-121212121202',
  p.id,
  e.id,
  '13131313-1313-4313-8313-131313131303',
  'processing',
  'private',
  '12121212-1212-4212-8212-121212121202/14141414-1414-4414-8414-141414141401.wav'
from public.prompts p
cross join public.energy_modifiers e
where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss';

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  '14141414-1414-4414-8414-141414141401',
  80, 80, 80, 80, 80,
  'Blocked entry', 'A trusted stale write still cannot enter the matchup.',
  'test-v1', 'test', 'test'
);

select is(
  (select count(*)::integer from public.get_challenge_by_invite('BLOCKN03', 'post-block-trusted-token')),
  0,
  'the resolver denies a bound blocked pair even if a trusted stale path created a row'
);
select throws_ok(
  $$ insert into public.challenge_entries (challenge_id, delivery_id, entrant_id)
     values (
       '13131313-1313-4313-8313-131313131303',
       '14141414-1414-4414-8414-141414141401',
       '12121212-1212-4212-8212-121212121202'
     ) $$,
  'P0001',
  'Challenge is unavailable between blocked users',
  'the admission trigger rejects a blocked pair even behind a trusted insert'
);

delete from public.blocks
where blocker_id = '12121212-1212-4212-8212-121212121201'
  and blocked_id = '12121212-1212-4212-8212-121212121202';

select ok(
  (select pg_catalog.bool_and(c.token_digest is null)
   from public.challenges c
   where c.id in ('13131313-1313-4313-8313-131313131301', '13131313-1313-4313-8313-131313131302')),
  'unblocking cannot resurrect either revoked signed receipt'
);

insert into public.account_restrictions (user_id, kind, reason)
values (
  '12121212-1212-4212-8212-121212121201',
  'profile-limit',
  'Challenge side-channel fixture'
);

select is(
  (select count(*)::integer from public.get_challenge_by_invite('BLOCKN03', 'post-block-trusted-token')),
  0,
  'a signed invite cannot expose a profile-contained creator after unblock'
);
select ok(
  not public.can_view_challenge('13131313-1313-4313-8313-131313131303'),
  'challenge RLS denies participant access during profile containment'
);
select throws_ok(
  $$ insert into public.challenge_entries (challenge_id, delivery_id, entrant_id)
     values (
       '13131313-1313-4313-8313-131313131303',
       '14141414-1414-4414-8414-141414141401',
       '12121212-1212-4212-8212-121212121202'
     ) $$,
  'P0001',
  'Challenge is unavailable during profile containment',
  'challenge admission cannot revive a profile-contained matchup'
);

select * from finish();
rollback;
