-- Checked publishing and durable Stripe webhook processing.

create type public.stripe_webhook_event_state as enum ('processing', 'processed', 'ignored', 'failed');

create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  stripe_created_at timestamptz not null,
  livemode boolean not null,
  payload_hash text,
  state public.stripe_webhook_event_state not null default 'processing',
  attempt_count integer not null default 1,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_webhook_events_id_length check (char_length(event_id) between 4 and 255),
  constraint stripe_webhook_events_type_length check (char_length(event_type) between 3 and 160),
  constraint stripe_webhook_events_hash_length check (payload_hash is null or char_length(payload_hash) between 16 and 128),
  constraint stripe_webhook_events_attempts check (attempt_count > 0),
  constraint stripe_webhook_events_error_length check (last_error is null or char_length(last_error) <= 2000),
  constraint stripe_webhook_events_completion check (
    (state in ('processed', 'ignored') and processed_at is not null)
    or (state in ('processing', 'failed') and processed_at is null)
  )
);

create index stripe_webhook_events_queue_idx
  on public.stripe_webhook_events (state, updated_at);
alter table public.stripe_webhook_events enable row level security;
create trigger stripe_webhook_events_set_updated_at
  before update on public.stripe_webhook_events
  for each row execute function public.set_updated_at();

alter table public.subscriptions
  add column stripe_event_created_at timestamptz,
  add column stripe_event_id text references public.stripe_webhook_events(event_id) on delete set null;

create or replace function public.enforce_public_delivery_approval()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.visibility = 'public' then
    if not ('publish-approved' = any(new.moderation_labels))
       or exists (
         select 1 from unnest(new.moderation_labels) as label
         where label in (
           'publish-rejected', 'publish-review', 'publish-limited',
           'publish-moderation-unavailable', 'harassment', 'hate', 'sexual',
           'violence', 'self-harm', 'privacy'
         )
       ) then
      raise exception using errcode = '23514', message = 'Public deliveries require explicit, clear moderation approval';
    end if;
  end if;
  return new;
end;
$$;

create trigger deliveries_require_public_approval
  before insert or update of visibility, moderation_labels on public.deliveries
  for each row execute function public.enforce_public_delivery_approval();

create or replace function public.set_delivery_visibility(
  p_delivery_id uuid,
  p_visibility public.delivery_visibility,
  p_user_id uuid default null
)
returns table (
  delivery_id uuid,
  visibility public.delivery_visibility,
  published_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_role text := auth.role();
  target_user_id uuid;
  delivery public.deliveries;
begin
  if caller_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may change delivery visibility';
  end if;
  target_user_id := p_user_id;
  if target_user_id is null then
    raise exception using errcode = '22023', message = 'A target user is required';
  end if;
  if p_visibility not in ('private', 'public') then
    raise exception using errcode = '22023', message = 'Use public to publish or private to unpublish';
  end if;

  select * into delivery from public.deliveries where id = p_delivery_id for update;
  if not found or delivery.user_id is distinct from target_user_id then
    raise exception using errcode = '42501', message = 'Delivery not found for this user';
  end if;

  if p_visibility = 'public' then
    if delivery.state <> 'judged'
       or delivery.recording_path is null
       or not exists (select 1 from public.delivery_scores s where s.delivery_id = delivery.id) then
      raise exception using errcode = '55000', message = 'Only complete judged deliveries can be published';
    end if;
    if public.has_active_restriction(target_user_id, 'publish') then
      raise exception using errcode = '42501', message = 'Publishing is temporarily restricted';
    end if;
    if not ('publish-approved' = any(delivery.moderation_labels)) then
      raise exception using errcode = '42501', message = 'Explicit publishing approval is required';
    end if;
    if exists (
      select 1 from unnest(delivery.moderation_labels) as label
      where label in (
              'publish-rejected', 'publish-review', 'publish-limited',
              'publish-moderation-unavailable'
            )
         or label in ('harassment', 'hate', 'sexual', 'violence', 'self-harm', 'privacy')
    ) then
      raise exception using errcode = '42501', message = 'Delivery has not passed publishing review';
    end if;
  end if;

  update public.deliveries d
  set visibility = p_visibility,
      published_at = case when p_visibility = 'public' then coalesce(d.published_at, now()) else null end
  where d.id = delivery.id;

  return query
  select d.id, d.visibility, d.published_at from public.deliveries d where d.id = delivery.id;
end;
$$;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_stripe_created_at timestamptz,
  p_livemode boolean,
  p_payload_hash text default null
)
returns table (
  claimed boolean,
  state public.stripe_webhook_event_state,
  attempt_count integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_role text := auth.role();
  inserted_count integer := 0;
  event public.stripe_webhook_events;
begin
  if caller_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may claim Stripe events';
  end if;
  if p_event_id is null or char_length(p_event_id) not between 4 and 255
     or p_event_type is null or char_length(p_event_type) not between 3 and 160
     or p_stripe_created_at is null or p_livemode is null then
    raise exception using errcode = '22023', message = 'Invalid Stripe event metadata';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, stripe_created_at, livemode, payload_hash, state
  ) values (
    p_event_id, p_event_type, p_stripe_created_at, p_livemode, p_payload_hash, 'processing'
  ) on conflict (event_id) do nothing;
  get diagnostics inserted_count = row_count;

  select * into event from public.stripe_webhook_events where event_id = p_event_id for update;
  if event.event_type is distinct from p_event_type
     or event.stripe_created_at is distinct from p_stripe_created_at
     or event.livemode is distinct from p_livemode
     or (event.payload_hash is not null and p_payload_hash is not null and event.payload_hash is distinct from p_payload_hash) then
    raise exception using errcode = '22000', message = 'Stripe event metadata does not match the original claim';
  end if;

  if inserted_count = 0 and event.state in ('processed', 'ignored') then
    return query select false, event.state, event.attempt_count;
    return;
  end if;
  if inserted_count = 0 and event.state = 'processing' and event.updated_at > now() - interval '10 minutes' then
    return query select false, event.state, event.attempt_count;
    return;
  end if;
  if inserted_count = 0 then
    update public.stripe_webhook_events
    set state = 'processing',
        attempt_count = attempt_count + 1,
        last_error = null,
        processed_at = null,
        updated_at = now()
    where event_id = p_event_id
    returning * into event;
  end if;

  return query select true, 'processing'::public.stripe_webhook_event_state, event.attempt_count;
end;
$$;

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
  select * into event from public.stripe_webhook_events where event_id = p_event_id for update;
  if not found or event.state <> 'processing' then
    raise exception using errcode = '55000', message = 'Stripe event must be claimed before applying';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'Subscription metadata must be an object';
  end if;

  insert into public.subscriptions (
    user_id, tier, state, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, cancel_at_period_end, current_period_start,
    current_period_end, trial_ends_at, metadata,
    stripe_event_created_at, stripe_event_id
  ) values (
    p_user_id, p_tier, p_state, p_stripe_customer_id, p_stripe_subscription_id,
    p_stripe_price_id, p_cancel_at_period_end, p_current_period_start,
    p_current_period_end, p_trial_ends_at, p_metadata,
    event.stripe_created_at, event.event_id
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
    updated_at = now()
  where public.subscriptions.stripe_event_created_at is null
     or excluded.stripe_event_created_at > public.subscriptions.stripe_event_created_at
     or (
       excluded.stripe_event_created_at = public.subscriptions.stripe_event_created_at
       and excluded.stripe_event_id > coalesce(public.subscriptions.stripe_event_id, '')
     );
  get diagnostics affected_count = row_count;

  return query select affected_count = 1, affected_count = 0;
end;
$$;

create or replace function public.finish_stripe_webhook_event(
  p_event_id text,
  p_state public.stripe_webhook_event_state,
  p_error text default null
)
returns table (finished boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_role text := auth.role();
  affected_count integer := 0;
begin
  if caller_role is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may finish Stripe events';
  end if;
  if p_state not in ('processed', 'ignored', 'failed') then
    raise exception using errcode = '22023', message = 'Stripe event must finish as processed, ignored, or failed';
  end if;
  if p_error is not null and char_length(p_error) > 2000 then
    p_error := left(p_error, 2000);
  end if;

  update public.stripe_webhook_events
  set state = p_state,
      last_error = case when p_state = 'failed' then p_error else null end,
      processed_at = case when p_state in ('processed', 'ignored') then now() else null end,
      updated_at = now()
  where event_id = p_event_id and state = 'processing';
  get diagnostics affected_count = row_count;
  return query select affected_count = 1;
end;
$$;

revoke all on table public.stripe_webhook_events from anon, authenticated;
revoke all on function public.enforce_public_delivery_approval() from public, anon, authenticated;
revoke all on function public.set_delivery_visibility(uuid, public.delivery_visibility, uuid) from public, anon, authenticated;
revoke all on function public.claim_stripe_webhook_event(text, text, timestamptz, boolean, text) from public, anon, authenticated;
revoke all on function public.apply_stripe_subscription_event(text, uuid, public.plan_tier, public.subscription_state, text, text, text, boolean, timestamptz, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.finish_stripe_webhook_event(text, public.stripe_webhook_event_state, text) from public, anon, authenticated;
grant execute on function public.set_delivery_visibility(uuid, public.delivery_visibility, uuid) to service_role;
grant execute on function public.claim_stripe_webhook_event(text, text, timestamptz, boolean, text) to service_role;
grant execute on function public.apply_stripe_subscription_event(text, uuid, public.plan_tier, public.subscription_state, text, text, text, boolean, timestamptz, timestamptz, timestamptz, jsonb) to service_role;
grant execute on function public.finish_stripe_webhook_event(text, public.stripe_webhook_event_state, text) to service_role;

comment on function public.set_delivery_visibility(uuid, public.delivery_visibility, uuid) is 'Service-only publish/unpublish gate; public requires a judged, scored delivery with explicit publish-approved moderation state.';
comment on table public.stripe_webhook_events is 'Durable Stripe idempotency ledger. Payloads are represented by hashes, not stored wholesale.';
comment on function public.apply_stripe_subscription_event(text, uuid, public.plan_tier, public.subscription_state, text, text, text, boolean, timestamptz, timestamptz, timestamptz, jsonb) is 'Service-only ordered subscription snapshot application; stale events are a successful no-op.';
