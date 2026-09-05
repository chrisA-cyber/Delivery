begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

select has_column('public'::name, 'subscriptions'::name, 'stripe_snapshot_retrieved_at'::name, 'subscriptions.stripe_snapshot_retrieved_at exists');
select has_function(
  'public'::name,
  'apply_stripe_subscription_event'::name,
  array[
    'text', 'uuid', 'plan_tier', 'subscription_state', 'text', 'text', 'text',
    'boolean', 'timestamp with time zone', 'timestamp with time zone',
    'timestamp with time zone', 'timestamp with time zone', 'jsonb'
  ]
);
select hasnt_function(
    'public'::name,
    'apply_stripe_subscription_event'::name,
    array[
      'text', 'uuid', 'plan_tier', 'subscription_state', 'text', 'text', 'text',
      'boolean', 'timestamp with time zone', 'timestamp with time zone',
      'timestamp with time zone', 'jsonb'
    ],
  'the opaque-event-id ordering RPC signature is removed'
);
select ok(
  position(
    'stripe_snapshot_retrieved_at' in pg_get_functiondef(
      'public.apply_stripe_subscription_event(text,uuid,public.plan_tier,public.subscription_state,text,text,text,boolean,timestamptz,timestamptz,timestamptz,timestamptz,jsonb)'::regprocedure
    )
  ) > 0,
  'the apply RPC orders same-second events by current snapshot retrieval'
);
select ok(
  position(
    'stripe_event_id >' in pg_get_functiondef(
      'public.apply_stripe_subscription_event(text,uuid,public.plan_tier,public.subscription_state,text,text,text,boolean,timestamptz,timestamptz,timestamptz,timestamptz,jsonb)'::regprocedure
    )
  ) = 0,
  'opaque Stripe event IDs are never used as a causal clock'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values (
  'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'stripe-order@example.test',
  '{"user_name":"stripe_order"}'::jsonb,
  now(), now()
);

set local "request.jwt.claim.role" = 'service_role';

select ok((select claimed from public.claim_stripe_webhook_event(
  'evt_z_active', 'customer.subscription.updated', now() - interval '1 hour',
  false, null
)), 'first same-second event is claimed');
select ok((select applied from public.apply_stripe_subscription_event(
  'evt_z_active', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'pro', 'active',
  'cus_order', 'sub_order', 'price_delivery', false,
  now() - interval '1 day', now() + interval '1 month', null,
  now() - interval '2 minutes', '{}'::jsonb
)), 'the first current snapshot applies');
select ok((select finished from public.finish_stripe_webhook_event(
  'evt_z_active', 'processed', null
)), 'first event finishes');

select ok((select claimed from public.claim_stripe_webhook_event(
  'evt_a_deleted', 'customer.subscription.deleted', now() - interval '1 hour',
  false, null
)), 'lexicographically smaller same-second event is claimed');
select ok((select applied from public.apply_stripe_subscription_event(
  'evt_a_deleted', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'pro', 'canceled',
  'cus_order', 'sub_order', 'price_delivery', false,
  now() - interval '1 day', now(), null,
  now() - interval '1 minute', '{}'::jsonb
)), 'the later current snapshot applies regardless of opaque event ID order');

select ok((select claimed from public.claim_stripe_webhook_event(
  'evt_older_trigger_new_snapshot', 'customer.subscription.updated',
  now() - interval '2 hours', false, null
)), 'a delayed older trigger is claimed for current-object reconciliation');
select ok((select applied from public.apply_stripe_subscription_event(
  'evt_older_trigger_new_snapshot', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'pro', 'active', 'cus_order', 'sub_order', 'price_delivery', false,
  now() - interval '1 day', now() + interval '1 month', null,
  now(), '{}'::jsonb
)), 'a newer authoritative snapshot applies even when its trigger event is older');
select is(
  (select state::text from public.subscriptions where user_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
  'active',
  'the newer current snapshot becomes the entitlement state'
);

select ok((select claimed from public.claim_stripe_webhook_event(
  'evt_new_trigger_stale_snapshot', 'customer.subscription.deleted',
  now(), false, null
)), 'a newer trigger with an earlier in-flight snapshot is claimed');
select ok((select stale from public.apply_stripe_subscription_event(
  'evt_new_trigger_stale_snapshot', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  'pro', 'canceled', 'cus_order', 'sub_order', 'price_delivery', false,
  now() - interval '1 day', now(), null,
  now() - interval '3 minutes', '{}'::jsonb
)), 'a delayed commit cannot overwrite a later-retrieved authoritative snapshot');
select is(
  (select state::text from public.subscriptions where user_id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
  'active',
  'the stale in-flight snapshot leaves entitlement unchanged'
);

select * from finish();
rollback;
