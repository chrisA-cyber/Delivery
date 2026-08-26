begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

select has_table('public', 'account_deletion_jobs');
select has_column('public', 'account_deletion_jobs', 'checkpoint');
select has_column('public', 'account_deletion_jobs', 'stripe_customer_id');
select has_column('public', 'account_deletion_jobs', 'last_error_code');
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.account_deletion_jobs'::regclass),
  'account deletion receipts have RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.account_deletion_jobs', 'SELECT'),
  'account deletion receipts are not browser-readable'
);
select ok(
  not has_table_privilege('authenticated', 'public.account_deletion_jobs', 'INSERT,UPDATE,DELETE'),
  'browser clients cannot forge or advance deletion receipts'
);
select has_function('public', 'begin_account_deletion', array['uuid']);
select has_function(
  'public',
  'advance_account_deletion',
  array['uuid', 'text', 'text', 'text', 'text']
);
select ok(
  has_function_privilege('service_role', 'public.begin_account_deletion(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.begin_account_deletion(uuid)', 'EXECUTE'),
  'only the service can begin deletion'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.advance_account_deletion(uuid,text,text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.advance_account_deletion(uuid,text,text,text,text)',
    'EXECUTE'
  ),
  'only the service can advance deletion'
);
select has_trigger('public', 'deliveries', 'deliveries_reject_account_deletion');
select has_function(
  'public',
  'reconcile_completed_account_deletions',
  array['integer']
);
select ok(
  has_function_privilege(
    'service_role',
    'public.reconcile_completed_account_deletions(integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.reconcile_completed_account_deletions(integer)',
    'EXECUTE'
  ),
  'only operations can reconcile a lost final deletion receipt'
);
select ok(
  position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'public.reject_delivery_during_account_deletion()'::regprocedure
    )
  ) > 0,
  'delivery persistence serializes against deletion containment'
);
select ok(
  position(
    'account_deletion_jobs' in pg_get_functiondef(
      'public.get_challenge_by_invite(text,text)'::regprocedure
    )
  ) > 0,
  'signed challenge receipts fail closed for deleting participants'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '99999999-9999-4999-8999-999999999991',
  'delete-saga@example.test',
  '{"user_name":"delete_saga"}'::jsonb,
  now(), now()
);
update public.subscriptions
set stripe_customer_id = 'cus_delete_saga_fixture'
where user_id = '99999999-9999-4999-8999-999999999991';

set local "request.jwt.claim.role" = 'service_role';

select is(
  public.begin_account_deletion('99999999-9999-4999-8999-999999999991') ->> 'checkpoint',
  'contained',
  'begin creates a contained, resumable deletion job'
);
select ok(
  (select is_private from public.profiles where id = '99999999-9999-4999-8999-999999999991'),
  'begin immediately makes the profile private'
);
select is(
  (
    select count(*)::integer
    from public.account_restrictions
    where user_id = '99999999-9999-4999-8999-999999999991'
      and reason = 'Account deletion in progress'
  ),
  4,
  'begin blocks recording, publishing, challenges, and submissions'
);
select is(
  public.begin_account_deletion('99999999-9999-4999-8999-999999999991') ->> 'attemptCount',
  '2',
  'a retry advances the durable attempt receipt'
);
select is(
  (
    select count(*)::integer
    from public.account_restrictions
    where user_id = '99999999-9999-4999-8999-999999999991'
      and reason = 'Account deletion in progress'
  ),
  4,
  'a retry does not duplicate account-deletion restrictions'
);
select is(
  public.advance_account_deletion(
    '99999999-9999-4999-8999-999999999991', 'billing_deleted'
  ) ->> 'checkpoint',
  'billing_deleted',
  'the billing checkpoint advances monotonically'
);
select throws_ok(
  $$
    select public.advance_account_deletion(
      '99999999-9999-4999-8999-999999999991', 'contained'
    )
  $$,
  '22023',
  'Account deletion checkpoint cannot move backwards',
  'a retry cannot erase a completed provider checkpoint'
);
select throws_ok(
  $$
    insert into public.deliveries (user_id, prompt_id, state, visibility)
    select
      '99999999-9999-4999-8999-999999999991',
      p.id,
      'processing',
      'private'
    from public.prompts p
    where p.state = 'published'
    limit 1
  $$,
  '55000',
  'Account deletion is already in progress',
  'a raced judge cannot persist new media-backed content after containment'
);

select * from finish();
rollback;
