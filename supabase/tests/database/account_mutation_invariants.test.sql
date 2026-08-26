begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

select has_function('public', 'lock_users_for_account_mutation', array['uuid[]']);
select has_function('public', 'lock_interaction_pair', array['uuid', 'uuid']);
select has_trigger('public', 'profiles', 'profiles_enforce_moderation_containment');
select has_trigger('public', 'follows', 'follows_guard_interaction_insert');
select has_trigger('public', 'blocks', 'blocks_guard_interaction_insert');
select has_trigger('public', 'reactions', 'reactions_guard_interaction_insert');
select has_trigger('public', 'challenges', 'challenges_guard_account_insert');
select has_trigger('public', 'stream_sessions', 'stream_sessions_guard_account_insert');
select has_trigger('public', 'line_submissions', 'line_submissions_guard_account_insert');
select ok(
  not has_function_privilege(
    'authenticated',
    'public.lock_users_for_account_mutation(uuid[])',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.lock_interaction_pair(uuid,uuid)',
    'EXECUTE'
  ),
  'browser clients cannot invoke serialization helpers directly'
);
select ok(
  position(
    '''delivery-account-delete:''' in lower(pg_get_functiondef(
      'public.begin_account_deletion(uuid)'::regprocedure
    ))
  ) > 0
  and position(
    '''delivery-account-delete:''' in lower(pg_get_functiondef(
      'public.lock_users_for_account_mutation(uuid[])'::regprocedure
    ))
  ) > 0,
  'account deletion and competing writes use the same advisory-lock namespace'
);
select ok(
  position(
    'lock_users_for_account_mutation' in lower(pg_get_functiondef(
      'public.enforce_profile_moderation_containment()'::regprocedure
    ))
  ) > 0,
  'profile updates serialize against account deletion before containment checks'
);
select ok(
  position(
    'lock_interaction_pair' in lower(pg_get_functiondef(
      'public.guard_follow_insert()'::regprocedure
    ))
  ) > 0
  and position(
    'lock_interaction_pair' in lower(pg_get_functiondef(
      'public.guard_block_insert()'::regprocedure
    ))
  ) > 0,
  'follow and block writes serialize on the same unordered pair'
);
select ok(
  position(
    'delete from public.reactions' in lower(pg_get_functiondef(
      'public.remove_follows_on_block()'::regprocedure
    ))
  ) > 0,
  'block cleanup removes cross-pair reactions as well as follows'
);
select ok(
  position(
    '''profile-limit''' in lower(pg_get_functiondef(
      'public.can_view_profile(uuid)'::regprocedure
    ))
  ) > 0
  and position(
    '''profile-remove''' in lower(pg_get_functiondef(
      'public.can_view_profile(uuid)'::regprocedure
    ))
  ) > 0,
  'profile RLS directly rejects every active moderation containment'
);
select ok(
  position(
    'for key share' in lower(pg_get_functiondef(
      'public.guard_follow_insert()'::regprocedure
    ))
  ) > 0
  and position(
    'target_is_private' in lower(pg_get_functiondef(
      'public.guard_follow_insert()'::regprocedure
    ))
  ) > 0,
  'follow insert locks and rechecks current target privacy inside the mutation'
);
select ok(
  position('''profile-limit''' in lower(pg_get_functiondef('public.can_view_challenge(uuid)'::regprocedure))) > 0
  and position('''profile-limit''' in lower(pg_get_functiondef('public.get_challenge_by_invite(text,text)'::regprocedure))) > 0
  and position('''profile-limit''' in lower(pg_get_functiondef('public.validate_challenge_entry()'::regprocedure))) > 0,
  'challenge RLS, signed lookup, and admission all reject profile containment'
);
select ok(
  position(
    '''delivery-account-delete:''' in lower(pg_get_functiondef(
      'public.resolve_moderation_report(uuid,uuid,public.moderation_decision,text,text)'::regprocedure
    ))
  ) > 0,
  'profile moderation takes the account lock before its row containment lock'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('15151515-1515-4515-8515-151515151501', 'interaction-a@example.test', '{"user_name":"interaction_a"}'::jsonb, now(), now()),
  ('15151515-1515-4515-8515-151515151502', 'interaction-b@example.test', '{"user_name":"interaction_b"}'::jsonb, now(), now()),
  ('15151515-1515-4515-8515-151515151503', 'deleting-user@example.test', '{"user_name":"deleting_user"}'::jsonb, now(), now());

insert into public.deliveries (
  id, user_id, prompt_id, state, visibility,
  recording_path, moderation_labels, scored_at
)
select
  '16161616-1616-4616-8616-161616161601',
  '15151515-1515-4515-8515-151515151502',
  p.id,
  'processing',
  'private',
  '15151515-1515-4515-8515-151515151502/16161616-1616-4616-8616-161616161601.wav',
  array['publish-approved'],
  now()
from public.prompts p
where p.slug = 'timeline-needs-me';

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  '16161616-1616-4616-8616-161616161601',
  80, 80, 80, 80, 80,
  'Interaction target', 'The target exists for reaction serialization.',
  'test-v1', 'test', 'test'
);

set local "request.jwt.claim.role" = 'service_role';
do $$
begin
  perform * from public.set_delivery_visibility(
    '16161616-1616-4616-8616-161616161601',
    'public',
    '15151515-1515-4515-8515-151515151502'
  );
end;
$$;

insert into public.follows (follower_id, following_id)
values ('15151515-1515-4515-8515-151515151501', '15151515-1515-4515-8515-151515151502');
insert into public.reactions (delivery_id, user_id, kind)
values ('16161616-1616-4616-8616-161616161601', '15151515-1515-4515-8515-151515151501', 'fire');

select is(
  (
    select row(
      (select count(*) from public.follows f where f.follower_id = '15151515-1515-4515-8515-151515151501' and f.following_id = '15151515-1515-4515-8515-151515151502'),
      (select count(*) from public.reactions r where r.delivery_id = '16161616-1616-4616-8616-161616161601' and r.user_id = '15151515-1515-4515-8515-151515151501')
    )::text
  ),
  row(1::bigint, 1::bigint)::text,
  'the fixture starts with a follow and reaction across the pair'
);

insert into public.blocks (blocker_id, blocked_id)
values ('15151515-1515-4515-8515-151515151502', '15151515-1515-4515-8515-151515151501');

select is(
  (
    select row(
      (select count(*) from public.follows f where f.follower_id = '15151515-1515-4515-8515-151515151501' and f.following_id = '15151515-1515-4515-8515-151515151502'),
      (select count(*) from public.reactions r where r.delivery_id = '16161616-1616-4616-8616-161616161601' and r.user_id = '15151515-1515-4515-8515-151515151501')
    )::text
  ),
  row(0::bigint, 0::bigint)::text,
  'block insertion atomically removes both stale social edges'
);
select throws_ok(
  $$ insert into public.follows (follower_id, following_id)
     values ('15151515-1515-4515-8515-151515151501', '15151515-1515-4515-8515-151515151502') $$,
  '55000',
  'Interaction is unavailable between blocked users',
  'a follow that arrives after block cleanup fails closed'
);
select throws_ok(
  $$ insert into public.reactions (delivery_id, user_id, kind)
     values ('16161616-1616-4616-8616-161616161601', '15151515-1515-4515-8515-151515151501', 'skull') $$,
  '55000',
  'Interaction is unavailable between blocked users',
  'a reaction that arrives after block cleanup fails closed'
);

update public.profiles
set display_name = 'Delete Me',
    bio = 'This copy must be redacted.',
    avatar_path = '15151515-1515-4515-8515-151515151503/avatar.png',
    is_private = false
where id = '15151515-1515-4515-8515-151515151503';

create temporary table deletion_receipt(payload jsonb not null) on commit drop;
insert into deletion_receipt
select public.begin_account_deletion('15151515-1515-4515-8515-151515151503');

select is(
  (select row(payload ->> 'state', payload ->> 'checkpoint')::text from deletion_receipt),
  row('processing', 'contained')::text,
  'account deletion returns its durable contained receipt'
);
select ok(
  (select is_private and display_name = 'Player' and bio is null and avatar_path is null
   from public.profiles where id = '15151515-1515-4515-8515-151515151503'),
  'beginning deletion synchronously forces the profile private and redacted'
);

update public.profiles
set display_name = 'Raced Restore',
    bio = 'This must not commit.',
    avatar_path = 'restored/avatar.png',
    is_private = false
where id = '15151515-1515-4515-8515-151515151503';

select ok(
  (select is_private and display_name = 'Player' and bio is null and avatar_path is null
   from public.profiles where id = '15151515-1515-4515-8515-151515151503'),
  'a stale trusted profile PATCH cannot undo deletion containment'
);
select throws_ok(
  $$ insert into public.follows (follower_id, following_id)
     values ('15151515-1515-4515-8515-151515151503', '15151515-1515-4515-8515-151515151502') $$,
  '55000',
  'Account deletion is already in progress',
  'a stale follow insert cannot cross deletion containment'
);
select throws_ok(
  $$ insert into public.reactions (delivery_id, user_id, kind)
     values ('16161616-1616-4616-8616-161616161601', '15151515-1515-4515-8515-151515151503', 'aura') $$,
  '55000',
  'Account deletion is already in progress',
  'a stale reaction insert cannot cross deletion containment'
);
select throws_ok(
  $$ insert into public.blocks (blocker_id, blocked_id)
     values ('15151515-1515-4515-8515-151515151503', '15151515-1515-4515-8515-151515151502') $$,
  '55000',
  'Account deletion is already in progress',
  'a stale block insert cannot cross deletion containment'
);
select throws_ok(
  $$ insert into public.challenges (
       code, token_digest, created_by, prompt_id, energy_modifier_id,
       state, visibility, expires_at
     )
     select
       'DELETE01',
       extensions.digest(pg_catalog.convert_to('deletion-challenge-token', 'UTF8'), 'sha256'),
       '15151515-1515-4515-8515-151515151503',
       p.id,
       e.id,
       'open',
       'link',
       now() + interval '7 days'
     from public.prompts p
     cross join public.energy_modifiers e
     where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss' $$,
  '55000',
  'Account deletion is already in progress',
  'a stale challenge insert cannot cross deletion containment'
);
select throws_ok(
  $$ insert into public.stream_sessions (host_id, code, title)
     values ('15151515-1515-4515-8515-151515151503', 'DEL01', 'Deletion race stream') $$,
  '55000',
  'Account deletion is already in progress',
  'a stale stream insert cannot cross deletion containment'
);
select throws_ok(
  $$ insert into public.line_submissions (submitted_by, proposed_body)
     values ('15151515-1515-4515-8515-151515151503', 'A stale submission after deletion began.') $$,
  '55000',
  'Account deletion is already in progress',
  'a stale line submission cannot cross deletion containment'
);

select * from finish();
rollback;
