begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

select has_column('public'::name, 'line_submissions'::name, 'normalized_body_hash'::name, 'line_submissions.normalized_body_hash exists');
select col_type_is('public'::name, 'line_submissions'::name, 'normalized_body_hash'::name, 'bytea');
select is(
  (
    select is_generated
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'line_submissions'
      and column_name = 'normalized_body_hash'
  ),
  'ALWAYS',
  'the normalized submission hash is database-generated'
);
select ok(
  (
    select i.indisunique and i.indpred is not null
    from pg_index i
    where i.indexrelid = 'public.line_submissions_active_body_hash_idx'::regclass
  ),
  'active submission hashes have a partial unique boundary'
);
select ok(
  position(
    'published' in pg_get_expr(
      (
        select i.indpred
        from pg_index i
        where i.indexrelid = 'public.line_submissions_active_body_hash_idx'::regclass
      ),
      'public.line_submissions'::regclass
    )
  ) > 0,
  'the duplicate boundary covers accepted published submissions'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '66666666-6666-4666-8666-666666666661',
    'submission-one@example.test',
    '{"user_name":"submission_one"}'::jsonb,
    now(), now()
  ),
  (
    '66666666-6666-4666-8666-666666666662',
    'submission-two@example.test',
    '{"user_name":"submission_two"}'::jsonb,
    now(), now()
  );

select lives_ok(
  $$
    insert into public.line_submissions (submitted_by, proposed_body, state)
    values (
      '66666666-6666-4666-8666-666666666661',
      E'  Main   Character\nEnergy!  ',
      'review'
    )
  $$,
  'the first normalized line enters moderation review'
);

select throws_ok(
  $$
    insert into public.line_submissions (submitted_by, proposed_body, state)
    values (
      '66666666-6666-4666-8666-666666666662',
      'main character energy!',
      'review'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "line_submissions_active_body_hash_idx"',
  'case and whitespace variants cannot create a second active review item'
);

select lives_ok(
  $$
    insert into public.line_submissions (submitted_by, proposed_body, state)
    values (
      '66666666-6666-4666-8666-666666666662',
      'main character energy!',
      'rejected'
    )
  $$,
  'a rejected copy may remain as moderation history'
);

select throws_ok(
  $$
    update public.line_submissions
    set state = 'review'
    where submitted_by = '66666666-6666-4666-8666-666666666662'
      and state = 'rejected'
  $$,
  '23505',
  'duplicate key value violates unique constraint "line_submissions_active_body_hash_idx"',
  'a rejected duplicate cannot re-enter review while an active copy exists'
);

update public.line_submissions
set state = 'archived'
where submitted_by = '66666666-6666-4666-8666-666666666661'
  and state = 'review';

select lives_ok(
  $$
    update public.line_submissions
    set state = 'review'
    where submitted_by = '66666666-6666-4666-8666-666666666662'
      and state = 'rejected'
  $$,
  'once the prior item is archived, a revised submission can re-enter review'
);

select is(current_setting('server_encoding'), 'UTF8', 'the Supabase hash compatibility contract uses UTF8');
select ok(
  not exists (
    select 1 from (values ('Hello'), (' café 🦆 '), (E'MiXeD\tCASE\nwords')) as samples(body)
    where extensions.digest(lower(regexp_replace(btrim(body), '[[:space:]]+', ' ', 'g')), 'sha256')
      <> extensions.digest(convert_to(lower(regexp_replace(btrim(body), '[[:space:]]+', ' ', 'g')), 'UTF8'), 'sha256')
  ),
  'immutable text hash preserves the original normalized UTF8 bytes, including Unicode'
);

select * from finish();
rollback;
