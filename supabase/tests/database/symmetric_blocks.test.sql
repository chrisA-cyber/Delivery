begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

select has_function('public', 'can_view_profile', array['uuid']);
select has_function('public', 'can_view_delivery', array['uuid']);
select has_function('public', 'remove_follows_on_block', array[]::text[]);
select has_trigger('public', 'blocks', 'blocks_remove_follows');
select ok(
  not has_function_privilege('authenticated', 'public.remove_follows_on_block()', 'EXECUTE'),
  'clients cannot invoke the follow cleanup trigger directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.blocks', 'INSERT'),
  'authenticated clients cannot bypass the validated block API with direct inserts'
);
select ok(
  not has_table_privilege('authenticated', 'public.blocks', 'DELETE'),
  'authenticated clients cannot bypass the validated block API with direct deletes'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'blocks'
      and policyname in ('users block as themselves', 'users unblock as themselves')
  ),
  0,
  'direct block mutation policies are removed'
);
select ok(
  has_table_privilege('authenticated', 'public.reactions', 'SELECT'),
  'reaction reads retain their visibility-scoped RLS path'
);
select ok(
  not has_table_privilege('authenticated', 'public.reactions', 'INSERT'),
  'authenticated clients cannot bypass the validated reaction API with inserts'
);
select ok(
  not has_table_privilege('authenticated', 'public.reactions', 'UPDATE'),
  'authenticated clients cannot bypass the validated reaction API with updates'
);
select ok(
  not has_table_privilege('authenticated', 'public.reactions', 'DELETE'),
  'authenticated clients cannot bypass the validated reaction API with deletes'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reactions'
      and policyname in (
        'users react as themselves',
        'users change own reaction',
        'users remove own reaction'
      )
  ),
  0,
  'direct reaction mutation policies are removed'
);
select ok(
  has_table_privilege('authenticated', 'public.follows', 'SELECT'),
  'follow reads retain their profile-scoped RLS path'
);
select ok(
  not has_table_privilege('authenticated', 'public.follows', 'INSERT'),
  'authenticated clients cannot bypass the validated follow API with inserts'
);
select ok(
  not has_table_privilege('authenticated', 'public.follows', 'DELETE'),
  'authenticated clients cannot bypass the validated follow API with deletes'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follows'
      and policyname in ('users follow as themselves', 'users unfollow as themselves')
  ),
  0,
  'direct follow mutation policies are removed'
);
select ok(
  position(
    'b.blocker_id = (select auth.uid()) and b.blocked_id = p.id' in
      lower(pg_get_functiondef('public.can_view_profile(uuid)'::regprocedure))
  ) > 0,
  'profile visibility checks blocks created by the viewer'
);
select ok(
  position(
    'b.blocker_id = (select auth.uid()) and b.blocked_id = d.user_id' in
      lower(pg_get_functiondef('public.can_view_delivery(uuid)'::regprocedure))
  ) > 0,
  'delivery visibility checks blocks created by the viewer'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '44444444-4444-4444-8444-444444444441',
    'block-target@example.test',
    '{"user_name":"block_target"}'::jsonb,
    now(), now()
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    'block-viewer@example.test',
    '{"user_name":"block_viewer"}'::jsonb,
    now(), now()
  );

insert into public.deliveries (
  id, user_id, prompt_id, state, visibility,
  recording_path, moderation_labels, scored_at
)
select
  '44444444-4444-4444-8444-444444444499',
  '44444444-4444-4444-8444-444444444441',
  p.id,
  'processing',
  'private',
  '44444444-4444-4444-8444-444444444441/44444444-4444-4444-8444-444444444499.wav',
  array['publish-approved'],
  now()
from public.prompts p
where p.slug = 'timeline-needs-me';

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values (
  '44444444-4444-4444-8444-444444444499',
  80, 80, 80, 80, 80,
  'Visible fixture', 'Visible until either account blocks the other.',
  'test-v1', 'test', 'test'
);

update public.deliveries
set visibility = 'public', published_at = now()
where id = '44444444-4444-4444-8444-444444444499';

set local "request.jwt.claim.sub" = '44444444-4444-4444-8444-444444444442';

select ok(
  public.can_view_profile('44444444-4444-4444-8444-444444444441'),
  'a viewer can initially see an unblocked public profile'
);
select ok(
  public.can_view_delivery('44444444-4444-4444-8444-444444444499'),
  'a viewer can initially see an unblocked public delivery'
);

insert into public.follows (follower_id, following_id)
values
  (
    '44444444-4444-4444-8444-444444444441',
    '44444444-4444-4444-8444-444444444442'
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '44444444-4444-4444-8444-444444444441'
  );

select is(
  (
    select count(*)::integer
    from public.follows
    where follower_id in (
      '44444444-4444-4444-8444-444444444441',
      '44444444-4444-4444-8444-444444444442'
    )
      and following_id in (
        '44444444-4444-4444-8444-444444444441',
        '44444444-4444-4444-8444-444444444442'
      )
  ),
  2,
  'the fixture begins with follows in both directions'
);

insert into public.blocks (blocker_id, blocked_id)
values (
  '44444444-4444-4444-8444-444444444442',
  '44444444-4444-4444-8444-444444444441'
);

select ok(
  not public.can_view_profile('44444444-4444-4444-8444-444444444441'),
  'blocking a creator hides that creator profile from the blocker'
);
select ok(
  not public.can_view_delivery('44444444-4444-4444-8444-444444444499'),
  'blocking a creator hides that creator delivery from the blocker'
);
select is(
  (
    select count(*)::integer
    from public.follows
    where follower_id in (
      '44444444-4444-4444-8444-444444444441',
      '44444444-4444-4444-8444-444444444442'
    )
      and following_id in (
        '44444444-4444-4444-8444-444444444441',
        '44444444-4444-4444-8444-444444444442'
      )
  ),
  0,
  'creating a block atomically severs follows in both directions'
);

delete from public.blocks
where blocker_id = '44444444-4444-4444-8444-444444444442'
  and blocked_id = '44444444-4444-4444-8444-444444444441';

select is(
  (
    select count(*)::integer
    from public.follows
    where follower_id in (
      '44444444-4444-4444-8444-444444444441',
      '44444444-4444-4444-8444-444444444442'
    )
      and following_id in (
        '44444444-4444-4444-8444-444444444441',
        '44444444-4444-4444-8444-444444444442'
      )
  ),
  0,
  'unblocking does not resurrect either prior follow relationship'
);

insert into public.blocks (blocker_id, blocked_id)
values (
  '44444444-4444-4444-8444-444444444441',
  '44444444-4444-4444-8444-444444444442'
);

select ok(
  not public.can_view_profile('44444444-4444-4444-8444-444444444441'),
  'being blocked by a creator hides that creator profile from the viewer'
);
select ok(
  not public.can_view_delivery('44444444-4444-4444-8444-444444444499'),
  'being blocked by a creator hides that creator delivery from the viewer'
);

select * from finish();
rollback;
