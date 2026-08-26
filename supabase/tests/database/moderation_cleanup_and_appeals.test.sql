begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

select has_table('public', 'moderation_storage_cleanup_jobs');
select has_column('public', 'moderation_storage_cleanup_jobs', 'next_attempt_at');
select has_index('public', 'moderation_storage_cleanup_jobs', 'moderation_cleanup_claim_idx');
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.moderation_storage_cleanup_jobs'::regclass),
  'moderation cleanup outbox has RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.moderation_storage_cleanup_jobs', 'SELECT,INSERT,UPDATE,DELETE'),
  'browser clients cannot inspect or forge cleanup jobs'
);
select has_trigger('public', 'moderation_actions', 'moderation_actions_enqueue_storage_cleanup');
select has_function('public', 'claim_moderation_storage_cleanup', array['integer', 'integer']);
select has_function('public', 'finish_moderation_storage_cleanup', array['uuid[]', 'boolean', 'text']);
select has_function('public', 'lift_moderation_restriction', array['uuid', 'uuid', 'text', 'text']);
select ok(
  has_function_privilege('service_role', 'public.claim_moderation_storage_cleanup(integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.claim_moderation_storage_cleanup(integer,integer)', 'EXECUTE'),
  'only the trusted worker can claim cleanup jobs'
);
select ok(
  has_function_privilege('service_role', 'public.lift_moderation_restriction(uuid,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.lift_moderation_restriction(uuid,uuid,text,text)', 'EXECUTE'),
  'staff browsers cannot bypass the audited restriction-lift route'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb1',
    'cleanup-moderator@example.test',
    '{"user_name":"cleanup_mod"}'::jsonb,
    now(), now()
  ),
  (
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2',
    'cleanup-target@example.test',
    '{"user_name":"cleanup_target"}'::jsonb,
    now(), now()
  );
update public.profiles
set role = 'moderator'
where id = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb1';
update public.profiles
set avatar_path = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2/avatar.png'
where id = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2';

insert into public.reports (id, reporter_id, profile_id, reason, state)
values (
  'bbbbbbbb-2222-4222-8222-bbbbbbbbbbb1',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb1',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2',
  'privacy',
  'open'
);
insert into public.moderation_actions (
  id, report_id, actor_id, subject_user_id, decision, reason
) values (
  'bbbbbbbb-3333-4333-8333-bbbbbbbbbbb1',
  'bbbbbbbb-2222-4222-8222-bbbbbbbbbbb1',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb1',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2',
  'remove',
  'Remove unsafe profile media'
);

select is(
  (
    select count(*)::integer
    from public.moderation_storage_cleanup_jobs
    where action_id = 'bbbbbbbb-3333-4333-8333-bbbbbbbbbbb1'
      and bucket = 'avatars'
  ),
  1,
  'a profile remove action atomically enqueues its public avatar'
);

insert into public.deliveries (
  id, user_id, prompt_id, state, visibility, share_asset_path
)
select
  'bbbbbbbb-4444-4444-8444-bbbbbbbbbbb1',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2',
  p.id,
  'processing',
  'private',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2/take/share.mp4'
from public.prompts p
where p.state = 'published'
limit 1;
insert into public.moderation_actions (
  id, actor_id, prompt_id, decision, reason
)
select
  'bbbbbbbb-3333-4333-8333-bbbbbbbbbbb2',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb1',
  p.id,
  'limit',
  'Limit unsafe prompt derivatives'
from public.prompts p
where p.state = 'published'
limit 1;

select is(
  (
    select count(*)::integer
    from public.moderation_storage_cleanup_jobs
    where action_id = 'bbbbbbbb-3333-4333-8333-bbbbbbbbbbb2'
      and bucket = 'delivery-share'
  ),
  1,
  'a prompt action atomically enqueues every referenced share derivative'
);

insert into public.moderation_actions (
  id, actor_id, subject_user_id, decision, reason
) values (
  'bbbbbbbb-3333-4333-8333-bbbbbbbbbbb3',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb1',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2',
  'limit',
  'Original profile restriction'
);
insert into public.account_restrictions (
  id, user_id, action_id, kind, reason
) values (
  'bbbbbbbb-5555-4555-8555-bbbbbbbbbbb1',
  'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2',
  'bbbbbbbb-3333-4333-8333-bbbbbbbbbbb3',
  'profile-limit',
  'Original profile restriction'
);

set local "request.jwt.claim.role" = 'service_role';

select is(
  public.lift_moderation_restriction(
    'bbbbbbbb-5555-4555-8555-bbbbbbbbbbb1',
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb1',
    'Appeal evidence cleared the restriction',
    'Verified by trust staff.'
  ) ->> 'remainingActiveProfileRestrictions',
  '0',
  'an appeal review produces a lift receipt'
);
select ok(
  (select ends_at is not null from public.account_restrictions where id = 'bbbbbbbb-5555-4555-8555-bbbbbbbbbbb1'),
  'the lifted restriction has a durable end timestamp'
);
select is(
  (
    select count(*)::integer from public.moderation_actions
    where subject_user_id = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbb2'
      and decision = 'allow'
      and reason like 'Restriction lifted:%'
  ),
  1,
  'the lift creates an immutable staff audit action'
);

select is(
  (select count(*)::integer from public.claim_moderation_storage_cleanup(100, 120)),
  2,
  'the worker atomically claims the avatar and share jobs'
);
select is(
  (select min(attempt_count) from public.moderation_storage_cleanup_jobs),
  1,
  'first claim records the first provider attempt'
);
select is(
  (
    select updated from public.finish_moderation_storage_cleanup(
      array(select id from public.moderation_storage_cleanup_jobs),
      false,
      'STORAGE_REMOVE_FAILED'
    )
  ),
  2,
  'a provider failure records both jobs for retry'
);
select is(
  (select count(*)::integer from public.moderation_storage_cleanup_jobs where state = 'retry'),
  2,
  'failed jobs remain durable in retry state'
);
select is(
  (select count(*)::integer from public.claim_moderation_storage_cleanup(100, 120)),
  0,
  'exponential backoff prevents an immediate retry hot loop'
);

update public.moderation_storage_cleanup_jobs set next_attempt_at = now() - interval '1 second';
select is(
  (select count(*)::integer from public.claim_moderation_storage_cleanup(100, 120)),
  2,
  'eligible retry jobs can be reclaimed after backoff'
);
select is(
  (
    select updated from public.finish_moderation_storage_cleanup(
      array(select id from public.moderation_storage_cleanup_jobs),
      true,
      null
    )
  ),
  2,
  'idempotent provider removal completes both receipts'
);
select is(
  (select count(*)::integer from public.moderation_storage_cleanup_jobs where state = 'completed'),
  2,
  'completed cleanup jobs retain an operations audit receipt'
);

select * from finish();
rollback;
