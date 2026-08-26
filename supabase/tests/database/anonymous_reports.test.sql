begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

select ok(
  (
    select is_nullable = 'YES'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reports'
      and column_name = 'reporter_id'
  ),
  'signed reporter identity is nullable for the anonymous safety path'
);
select has_column('public', 'reports', 'anonymous_reporter_hash');
select has_column('public', 'reports', 'anonymous_network_hash');
select col_type_is('public', 'reports', 'anonymous_reporter_hash', 'text');
select col_type_is('public', 'reports', 'anonymous_network_hash', 'text');
select has_index('public', 'reports', 'reports_anonymous_reporter_rate_idx');
select has_index('public', 'reports', 'reports_anonymous_network_rate_idx');

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  '77777777-7777-4777-8777-777777777771',
  'signed-reporter@example.test',
  '{"user_name":"signed_reporter"}'::jsonb,
  now(), now()
);

select lives_ok(
  $$
    insert into public.reports (reporter_id, prompt_id, reason, details)
    select
      '77777777-7777-4777-8777-777777777771',
      p.id,
      'privacy',
      'Signed safety report fixture.'
    from public.prompts p
    where p.slug = 'timeline-needs-me'
  $$,
  'a signed report stores only its account identity'
);

select lives_ok(
  $$
    insert into public.reports (
      anonymous_reporter_hash, anonymous_network_hash,
      prompt_id, reason, details
    )
    select
      repeat('a', 64),
      repeat('b', 64),
      p.id,
      'privacy',
      'Anonymous serious safety report fixture.'
    from public.prompts p
    where p.slug = 'timeline-needs-me'
  $$,
  'an anonymous report stores both keyed digests and no account identity'
);

select throws_ok(
  $$
    insert into public.reports (prompt_id, reason)
    select p.id, 'privacy'
    from public.prompts p
    where p.slug = 'timeline-needs-me'
  $$,
  '23514',
  'new row for relation "reports" violates check constraint "reports_reporter_identity"',
  'a report cannot omit both signed and anonymous identity'
);

select throws_ok(
  $$
    insert into public.reports (
      anonymous_reporter_hash, prompt_id, reason
    )
    select repeat('c', 64), p.id, 'privacy'
    from public.prompts p
    where p.slug = 'timeline-needs-me'
  $$,
  '23514',
  'new row for relation "reports" violates check constraint "reports_reporter_identity"',
  'an anonymous report must include its network digest as well as device digest'
);

select throws_ok(
  $$
    insert into public.reports (
      reporter_id, anonymous_reporter_hash, anonymous_network_hash,
      prompt_id, reason
    )
    select
      '77777777-7777-4777-8777-777777777771',
      repeat('d', 64),
      repeat('e', 64),
      p.id,
      'privacy'
    from public.prompts p
    where p.slug = 'timeline-needs-me'
  $$,
  '23514',
  'new row for relation "reports" violates check constraint "reports_reporter_identity"',
  'a signed report cannot also carry anonymous identity hashes'
);

select throws_ok(
  $$
    insert into public.reports (
      anonymous_reporter_hash, anonymous_network_hash,
      prompt_id, reason
    )
    select
      'not-a-64-hex-device-hash',
      repeat('f', 64),
      p.id,
      'privacy'
    from public.prompts p
    where p.slug = 'timeline-needs-me'
  $$,
  '23514',
  'new row for relation "reports" violates check constraint "reports_anonymous_reporter_hash_format"',
  'anonymous device identity rejects raw or malformed values'
);

select throws_ok(
  $$
    insert into public.reports (
      anonymous_reporter_hash, anonymous_network_hash,
      prompt_id, reason
    )
    select
      repeat('0', 64),
      '192.0.2.1',
      p.id,
      'privacy'
    from public.prompts p
    where p.slug = 'timeline-needs-me'
  $$,
  '23514',
  'new row for relation "reports" violates check constraint "reports_anonymous_network_hash_format"',
  'anonymous network identity rejects a raw IP address'
);

select * from finish();
rollback;
