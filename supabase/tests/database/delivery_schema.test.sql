begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(54);

select has_table('public'::name, 'profiles'::name);
select has_table('public'::name, 'profile_preferences'::name);
select has_table('public'::name, 'content_packs'::name);
select has_table('public'::name, 'prompts'::name);
select has_table('public'::name, 'energy_modifiers'::name);
select has_table('public'::name, 'deliveries'::name);
select has_table('public'::name, 'delivery_scores'::name);
select has_table('public'::name, 'challenges'::name);
select has_table('public'::name, 'line_submissions'::name);
select has_table('public'::name, 'subscriptions'::name);
select has_table('public'::name, 'reports'::name);
select has_table('public'::name, 'leaderboard_snapshots'::name);
select has_table('public'::name, 'trend_campaigns'::name);
select has_table('public'::name, 'blocks'::name);
select has_table('public'::name, 'judged_play_claims'::name);
select has_table('public'::name, 'stripe_webhook_events'::name);
select has_view('public'::name, 'delivery_feed'::name);
select has_view('public'::name, 'leaderboard_live'::name);
select has_view('public'::name, 'user_submissions'::name);
select has_function('public'::name, 'reserve_judged_play'::name, array['text', 'uuid']);
select has_function('public'::name, 'release_judged_play'::name, array['uuid', 'uuid']);
select has_function('public'::name, 'set_delivery_visibility'::name, array['uuid', 'delivery_visibility', 'uuid']);
select has_function('public'::name, 'claim_stripe_webhook_event'::name, array['text', 'text', 'timestamp with time zone', 'boolean', 'text']);
select has_function('public'::name, 'apply_stripe_subscription_event'::name, array['text', 'uuid', 'plan_tier', 'subscription_state', 'text', 'text', 'text', 'boolean', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone', 'jsonb']);
select has_function('public'::name, 'finish_stripe_webhook_event'::name, array['text', 'stripe_webhook_event_state', 'text']);
select has_trigger('public'::name, 'deliveries'::name, 'deliveries_require_public_approval'::name);

select col_default_is('public'::name, 'deliveries'::name, 'visibility'::name, 'private', 'column default remains compatible');
select col_is_pk('public'::name, 'delivery_scores'::name, array['delivery_id']);
select col_is_pk('public'::name, 'prompt_favorites'::name, array['user_id', 'prompt_id']);

select is(
  (select array_agg(policyname::text order by policyname::text) from pg_policies where schemaname = 'public' and tablename = 'deliveries'),
  array[
    'deliveries respect visibility'
  ]::text[],
  'deliveries are read-only to browser roles and respect visibility'
);

select is(
  (select array_agg(policyname::text order by policyname::text) from pg_policies where schemaname = 'public' and tablename = 'delivery_scores'),
  array['scores follow delivery visibility']::text[],
  'score policies are read-only'
);

select ok((select relrowsecurity from pg_class where oid = 'public.deliveries'::regclass), 'deliveries has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.profile_preferences'::regclass), 'profile preferences has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.judged_play_claims'::regclass), 'judged play claims have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.stripe_webhook_events'::regclass), 'Stripe event ledger has RLS');
select ok(
  not has_table_privilege('authenticated', 'public.deliveries', 'UPDATE'),
  'owners cannot directly mutate delivery paths or visibility'
);
select ok(
  not has_function_privilege('authenticated', 'public.set_delivery_visibility(uuid,delivery_visibility,uuid)', 'EXECUTE'),
  'only the trusted service can use the checked visibility RPC'
);
select ok(
  position(
    'publish-approved' in pg_get_functiondef(
      'public.set_delivery_visibility(uuid,delivery_visibility,uuid)'::regprocedure
    )
  ) > 0,
  'publishing requires an explicit moderation approval marker'
);
select ok((select relrowsecurity from pg_class where oid = 'public.delivery_scores'::regclass), 'delivery_scores has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.line_submissions'::regclass), 'line_submissions has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.subscriptions'::regclass), 'subscriptions has RLS');

select is((select count(*)::integer from public.content_packs where state = 'published' and draw_enabled), 6, '6 active Classic packs');
select is((select count(*)::integer from public.prompts where state = 'published' and draw_enabled and source = 'built_in'), 86, '86 active Classic prompts');
select is((select count(*)::integer from public.energy_modifiers where state = 'published' and draw_enabled), 36, '36 active Classic modifiers');
select is((select count(*)::integer from public.pack_prompts), 233, '86 active plus 147 historical prompt identities retain memberships');
select is((select count(*)::integer from public.prompts p left join public.pack_prompts pp on pp.prompt_id = p.id where p.source = 'built_in' and pp.prompt_id is null), 0, 'no orphan launch prompts');
select is((select count(*)::integer from public.daily_challenges where market = 'global'), 31, '31 seeded global daily challenges');
select is(
  (
    select count(*)::integer
    from public.daily_challenges dc
    where not exists (
      select 1
      from public.pack_prompts pp
      join public.content_packs pack on pack.id = pp.pack_id
      where pp.prompt_id = dc.prompt_id
        and pack.state = 'published'
        and pack.access in ('free', 'rotating')
        and (pack.available_from is null or pack.available_from <= (dc.challenge_date::timestamp at time zone 'UTC'))
        and (pack.available_until is null or pack.available_until > (dc.challenge_date::timestamp at time zone 'UTC'))
    )
  ),
  0,
  'every seeded Daily prompt is in an active Free or rotating pack'
);

select ok(
  not has_function_privilege('anon', 'public.reserve_judged_play(text,uuid)', 'EXECUTE'),
  'anonymous role cannot consume signed-in quota'
);
select ok(
  not has_function_privilege('authenticated', 'public.reserve_judged_play(text,uuid)', 'EXECUTE'),
  'signed-in clients cannot directly create durable quota claims'
);
select ok(
  not has_function_privilege('authenticated', 'public.release_judged_play(uuid,uuid)', 'EXECUTE'),
  'only the trusted service can release a reservation'
);
select ok(
  has_function_privilege('service_role', 'public.reserve_judged_play(text,uuid)', 'EXECUTE'),
  'trusted service can reserve judged-play quota'
);
select ok(
  has_function_privilege('service_role', 'public.release_judged_play(uuid,uuid)', 'EXECUTE'),
  'trusted service can release provider-failure reservations'
);

-- Pro content must never become the implicit fallback when no Free Daily prompt is
-- available. These changes are transaction-local and rolled back below.
update public.prompts p
set state = 'archived'
where exists (
  select 1
  from public.pack_prompts pp
  join public.content_packs pack on pack.id = pp.pack_id
  where pp.prompt_id = p.id and pack.access in ('free', 'rotating')
);
select throws_ok(
  $$ select public.ensure_daily_challenge(date '2099-01-01', 'pgtap-pro-only') $$,
  'P0001',
  'Published prompt and energy content must exist before generating a daily challenge',
  'Daily generation fails closed instead of selecting Pro-only content'
);

select * from finish();
rollback;
