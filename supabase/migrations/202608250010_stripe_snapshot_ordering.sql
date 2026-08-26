-- Stripe event IDs are opaque and do not encode causal order. Reconcile each
-- webhook against a freshly fetched current Customer subscription snapshot,
-- then order equal-second events by when that snapshot was retrieved.

alter table public.subscriptions
  add column stripe_snapshot_retrieved_at timestamptz;

drop function public.apply_stripe_subscription_event(
  text, uuid, public.plan_tier, public.subscription_state, text, text, text,
  boolean, timestamptz, timestamptz, timestamptz, jsonb
);

create or replace function public.apply_stripe_subscription_event(
  p_event_id text,
  p_user_id uuid,
  p_tier public.plan_tier,
  p_state public.subscription_state,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_cancel_at_period_end boolean,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_trial_ends_at timestamptz,
  p_snapshot_retrieved_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns table (applied boolean, stale boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_role text := auth.role();
  event public.stripe_webhook_events;
  affected_count integer := 0;
begin
  if caller_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may apply subscriptions';
  end if;
  select * into event
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;
  if not found or event.state <> 'processing' then
    raise exception using errcode = '55000', message = 'Stripe event must be claimed before applying';
  end if;
  if p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'Subscription metadata must be an object';
  end if;
  if p_snapshot_retrieved_at is null then
    raise exception using errcode = '22023', message = 'Stripe snapshot retrieval time is required';
  end if;

  insert into public.subscriptions (
    user_id, tier, state, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, cancel_at_period_end, current_period_start,
    current_period_end, trial_ends_at, metadata,
    stripe_event_created_at, stripe_event_id, stripe_snapshot_retrieved_at
  ) values (
    p_user_id, p_tier, p_state, p_stripe_customer_id, p_stripe_subscription_id,
    p_stripe_price_id, p_cancel_at_period_end, p_current_period_start,
    p_current_period_end, p_trial_ends_at, p_metadata,
    event.stripe_created_at, event.event_id, p_snapshot_retrieved_at
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    state = excluded.state,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    cancel_at_period_end = excluded.cancel_at_period_end,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    trial_ends_at = excluded.trial_ends_at,
    metadata = excluded.metadata,
    stripe_event_created_at = excluded.stripe_event_created_at,
    stripe_event_id = excluded.stripe_event_id,
    stripe_snapshot_retrieved_at = excluded.stripe_snapshot_retrieved_at,
    updated_at = now()
  where public.subscriptions.stripe_snapshot_retrieved_at is null
     or excluded.stripe_snapshot_retrieved_at > public.subscriptions.stripe_snapshot_retrieved_at
     or (
       excluded.stripe_snapshot_retrieved_at = public.subscriptions.stripe_snapshot_retrieved_at
       and case excluded.state
             when 'canceled' then 9
             when 'incomplete_expired' then 8
             when 'unpaid' then 7
             when 'paused' then 6
             when 'past_due' then 5
             when 'incomplete' then 4
             when 'active' then 3
             when 'trialing' then 2
             else 1
           end > case public.subscriptions.state
             when 'canceled' then 9
             when 'incomplete_expired' then 8
             when 'unpaid' then 7
             when 'paused' then 6
             when 'past_due' then 5
             when 'incomplete' then 4
             when 'active' then 3
             when 'trialing' then 2
             else 1
           end
     );
  get diagnostics affected_count = row_count;

  return query select affected_count = 1, affected_count = 0;
end;
$$;

revoke all on function public.apply_stripe_subscription_event(
  text, uuid, public.plan_tier, public.subscription_state, text, text, text,
  boolean, timestamptz, timestamptz, timestamptz, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(
  text, uuid, public.plan_tier, public.subscription_state, text, text, text,
  boolean, timestamptz, timestamptz, timestamptz, timestamptz, jsonb
) to service_role;

comment on column public.subscriptions.stripe_snapshot_retrieved_at is
  'Server timestamp immediately after retrieving the current Stripe customer subscription snapshot; causal tie-break for second-resolution event timestamps.';
comment on function public.apply_stripe_subscription_event(
  text, uuid, public.plan_tier, public.subscription_state, text, text, text,
  boolean, timestamptz, timestamptz, timestamptz, timestamptz, jsonb
) is
  'Service-only current-snapshot application. Orders authoritative current snapshots by retrieval time; provider event time/ID are audit metadata only, with fail-safe terminal status for an exact retrieval tie.';
