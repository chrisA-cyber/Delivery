begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(54);

select has_table('public', 'profiles');
select has_table('public', 'profile_preferences');
select has_table('public', 'content_packs');
select has_table('public', 'prompts');
select has_table('public', 'energy_modifiers');
select has_table('public', 'deliveries');
select has_table('public', 'delivery_scores');
select has_table('public', 'challenges');
select has_table('public', 'line_submissions');
select has_table('public', 'subscriptions');
select has_table('public', 'reports');
select has_table('public', 'leaderboard_snapshots');
select has_table('public', 'trend_campaigns');
select has_table('public', 'blocks');
select has_table('public', 'judged_play_claims');
select has_table('public', 'stripe_webhook_events');
select has_view('public', 'delivery_feed');
select has_view('public', 'leaderboard_live');
select has_view('public', 'user_submissions');
select has_function('public', 'reserve_judged_play', array['text', 'uuid']);
select has_function('public', 'release_judged_play', array['uuid', 'uuid']);
select has_function('public', 'set_delivery_visibility', array['uuid', 'delivery_visibility', 'uuid']);
select has_function('public', 'claim_stripe_webhook_event', array['text', 'text', 'timestamp with time zone', 'boolean', 'text']);
select has_function('public', 'apply_stripe_subscription_event', array['text', 'uuid', 'plan_tier', 'subscription_state', 'text', 'text', 'text', 'boolean', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone', 'jsonb']);
select has_function('public', 'finish_stripe_webhook_event', array['text', 'stripe_webhook_event_state', 'text']);
select has_trigger('public', 'deliveries', 'deliveries_require_public_approval');

select col_default_is('public', 'deliveries', 'visibility', '''private''::delivery_visibility');
select col_is_pk('public', 'delivery_scores', array['delivery_id']);
select col_is_pk('public', 'prompt_favorites', array['user_id', 'prompt_id']);

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

select is((select count(*)::integer from public.content_packs where state = 'published'), 12, '12 launch packs');
select is((select count(*)::integer from public.prompts where state = 'published' and source = 'built_in'), 120, '120 launch prompts');
select is((select count(*)::integer from public.energy_modifiers where state = 'published'), 48, '48 launch modifiers');
select is((select count(*)::integer from public.pack_prompts), 120, 'every launch prompt has pack membership');
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
