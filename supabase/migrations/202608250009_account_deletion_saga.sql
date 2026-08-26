-- Durable, privacy-first account erasure. The ledger deliberately has no user
-- foreign key so a completed/auth-cascaded deletion still has a reconciliation
-- receipt and an interrupted operation can resume from its last safe checkpoint.

create table public.account_deletion_jobs (
  user_id uuid primary key,
  state text not null default 'processing',
  checkpoint text not null default 'contained',
  stripe_customer_id text,
  attempt_count integer not null default 1,
  last_error_stage text,
  last_error_code text,
  requested_at timestamptz not null default now(),
  contained_at timestamptz not null default now(),
  billing_deleted_at timestamptz,
  media_deleted_at timestamptz,
  identity_deleted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint account_deletion_jobs_state check (
    state in ('processing', 'failed', 'completed')
  ),
  constraint account_deletion_jobs_checkpoint check (
    checkpoint in ('contained', 'billing_deleted', 'media_deleted', 'identity_deleted')
  ),
  constraint account_deletion_jobs_attempt_count check (attempt_count > 0),
  constraint account_deletion_jobs_error_stage check (
    last_error_stage is null or last_error_stage in ('billing', 'media', 'identity', 'receipt')
  ),
  constraint account_deletion_jobs_error_code check (
    last_error_code is null or char_length(last_error_code) between 1 and 80
  ),
  constraint account_deletion_jobs_completion check (
    (state = 'completed') = (completed_at is not null)
  )
);

alter table public.account_deletion_jobs enable row level security;
create trigger account_deletion_jobs_set_updated_at
  before update on public.account_deletion_jobs
  for each row execute function public.set_updated_at();

revoke all on table public.account_deletion_jobs from public, anon, authenticated;
grant select, insert, update on table public.account_deletion_jobs to service_role;

create or replace function public.begin_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_customer_id text;
  target_job public.account_deletion_jobs;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Only the trusted service may begin account deletion';
  end if;
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'Account user is required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception using errcode = '23503', message = 'Account profile not found';
  end if;

  -- Serialize deletion retries for the same account. The first request snapshots
  -- the billing customer; later retries never replace that receipt with null.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('delivery-account-delete:' || p_user_id::text, 0)
  );
  select s.stripe_customer_id
  into target_customer_id
  from public.subscriptions s
  where s.user_id = p_user_id;

  insert into public.account_deletion_jobs (
    user_id, state, checkpoint, stripe_customer_id
  )
  values (p_user_id, 'processing', 'contained', target_customer_id)
  on conflict (user_id) do update
  set state = 'processing',
      stripe_customer_id = coalesce(
        public.account_deletion_jobs.stripe_customer_id,
        excluded.stripe_customer_id
      ),
      attempt_count = public.account_deletion_jobs.attempt_count + 1,
      last_error_stage = null,
      last_error_code = null,
      completed_at = null
  returning * into target_job;

  -- Containment is synchronous and repeat-safe: no public identity, public take,
  -- signed challenge, or live stream remains reachable while providers retry.
  update public.profiles p
  set is_private = true
  where p.id = p_user_id;

  update public.deliveries d
  set state = 'removed',
      visibility = 'private',
      published_at = null,
      moderation_labels = case
        when 'account-deletion' = any(d.moderation_labels)
          then pg_catalog.array_remove(d.moderation_labels, 'publish-approved')
        else pg_catalog.array_append(
          pg_catalog.array_remove(d.moderation_labels, 'publish-approved'),
          'account-deletion'
        )
      end
  where d.user_id = p_user_id;

  update public.challenges c
  set state = 'canceled',
      visibility = 'private',
      message = case when c.created_by = p_user_id then null else c.message end
  where (c.created_by = p_user_id or c.recipient_user_id = p_user_id)
    and c.state in ('open', 'accepted', 'completed');

  update public.stream_sessions s
  set state = 'ended',
      ended_at = coalesce(s.ended_at, now())
  where s.host_id = p_user_id
    and s.state <> 'ended';

  insert into public.account_restrictions (user_id, kind, reason)
  select p_user_id, requested.kind, 'Account deletion in progress'
  from pg_catalog.unnest(array['recording', 'publish', 'challenge', 'submission'])
    as requested(kind)
  where not exists (
    select 1
    from public.account_restrictions r
    where r.user_id = p_user_id
      and r.kind = requested.kind
      and r.reason = 'Account deletion in progress'
      and (r.ends_at is null or r.ends_at > now())
  );

  update public.account_deletion_jobs j
  set contained_at = coalesce(j.contained_at, now())
  where j.user_id = p_user_id
  returning * into target_job;

  return pg_catalog.jsonb_build_object(
    'userId', target_job.user_id,
    'state', target_job.state,
    'checkpoint', target_job.checkpoint,
    'stripeCustomerId', target_job.stripe_customer_id,
    'attemptCount', target_job.attempt_count
  );
end;
$$;

create or replace function public.advance_account_deletion(
  p_user_id uuid,
  p_checkpoint text,
  p_state text default 'processing',
  p_error_stage text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_job public.account_deletion_jobs;
  current_rank integer;
  requested_rank integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Only the trusted service may advance account deletion';
  end if;
  if p_state not in ('processing', 'failed', 'completed') then
    raise exception using errcode = '22023', message = 'Invalid account deletion state';
  end if;
  current_rank := pg_catalog.array_position(
    array['contained', 'billing_deleted', 'media_deleted', 'identity_deleted'],
    (select j.checkpoint from public.account_deletion_jobs j where j.user_id = p_user_id)
  );
  requested_rank := pg_catalog.array_position(
    array['contained', 'billing_deleted', 'media_deleted', 'identity_deleted'],
    p_checkpoint
  );
  if current_rank is null then
    raise exception using errcode = '23503', message = 'Account deletion job not found';
  end if;
  if requested_rank is null or requested_rank < current_rank then
    raise exception using errcode = '22023', message = 'Account deletion checkpoint cannot move backwards';
  end if;
  if p_state = 'completed' and p_checkpoint <> 'identity_deleted' then
    raise exception using errcode = '22023', message = 'Identity deletion is required before completion';
  end if;
  if p_state = 'failed' and (p_error_stage is null or p_error_code is null) then
    raise exception using errcode = '22023', message = 'Failed deletion requires a safe error receipt';
  end if;

  update public.account_deletion_jobs j
  set checkpoint = p_checkpoint,
      state = p_state,
      billing_deleted_at = case
        when requested_rank >= 2 then coalesce(j.billing_deleted_at, now())
        else j.billing_deleted_at
      end,
      media_deleted_at = case
        when requested_rank >= 3 then coalesce(j.media_deleted_at, now())
        else j.media_deleted_at
      end,
      identity_deleted_at = case
        when requested_rank >= 4 then coalesce(j.identity_deleted_at, now())
        else j.identity_deleted_at
      end,
      completed_at = case when p_state = 'completed' then now() else null end,
      last_error_stage = case when p_state = 'failed' then p_error_stage else null end,
      last_error_code = case
        when p_state = 'failed' then pg_catalog.left(p_error_code, 80)
        else null
      end
  where j.user_id = p_user_id
  returning * into target_job;

  return pg_catalog.jsonb_build_object(
    'userId', target_job.user_id,
    'state', target_job.state,
    'checkpoint', target_job.checkpoint,
    'stripeCustomerId', target_job.stripe_customer_id,
    'attemptCount', target_job.attempt_count
  );
end;
$$;

-- A judge request that raced containment may have uploaded first. Blocking the
-- row insert makes its existing cleanup path remove that object, while a row
-- committed before containment is included in the paginated media sweep.
create or replace function public.reject_delivery_during_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('delivery-account-delete:' || new.user_id::text, 0)
  );
  if exists (
    select 1 from public.account_deletion_jobs j where j.user_id = new.user_id
  ) then
    raise exception using
      errcode = '55000',
      message = 'Account deletion is already in progress';
  end if;
  return new;
end;
$$;

-- Signed receipts fail closed as soon as either participant requests deletion.
-- This repeats the final 006 signature so callers do not gain a second route
-- around the synchronous cancellation performed by begin_account_deletion.
create or replace function public.get_challenge_by_invite(p_code text, p_token text)
returns table (
  id uuid,
  code text,
  created_by uuid,
  challenger_handle text,
  challenger_name text,
  challenger_avatar_path text,
  recipient_user_id uuid,
  prompt_id uuid,
  energy_modifier_id uuid,
  state public.challenge_state,
  visibility public.challenge_visibility,
  message text,
  max_entries smallint,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.code::text,
    c.created_by,
    p.handle::text,
    p.display_name,
    p.avatar_path,
    c.recipient_user_id,
    c.prompt_id,
    c.energy_modifier_id,
    c.state,
    c.visibility,
    c.message,
    c.max_entries,
    c.expires_at,
    c.created_at
  from public.challenges c
  join public.profiles p on p.id = c.created_by
  where pg_catalog.lower(c.code::text) = pg_catalog.lower(p_code)
    and c.token_digest is not null
    and c.token_digest = extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256')
    and c.state in ('open', 'accepted', 'completed')
    and c.expires_at > now()
    and not exists (
      select 1
      from public.account_deletion_jobs j
      where j.user_id = c.created_by or j.user_id = c.recipient_user_id
    )
  limit 1;
$$;

-- Executable operations reconciliation for the only irrecoverable response
-- edge: Auth deletion succeeded, but the final receipt update was unavailable.
create or replace function public.reconcile_completed_account_deletions(
  p_limit integer default 100
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reconciled_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Only the trusted service may reconcile account deletion';
  end if;
  if p_limit not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'Reconciliation limit is invalid';
  end if;

  with candidates as (
    select j.user_id
    from public.account_deletion_jobs j
    where j.checkpoint = 'media_deleted'
      and j.state in ('processing', 'failed')
      and not exists (select 1 from auth.users u where u.id = j.user_id)
    order by j.updated_at
    for update skip locked
    limit p_limit
  )
  update public.account_deletion_jobs j
  set checkpoint = 'identity_deleted',
      state = 'completed',
      identity_deleted_at = coalesce(j.identity_deleted_at, now()),
      completed_at = now(),
      last_error_stage = null,
      last_error_code = null
  from candidates c
  where j.user_id = c.user_id;
  get diagnostics reconciled_count = row_count;
  return reconciled_count;
end;
$$;

create trigger deliveries_reject_account_deletion
  before insert on public.deliveries
  for each row execute function public.reject_delivery_during_account_deletion();

revoke all on function public.begin_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.advance_account_deletion(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.reject_delivery_during_account_deletion()
  from public, anon, authenticated, service_role;
revoke all on function public.reconcile_completed_account_deletions(integer)
  from public, anon, authenticated;
grant execute on function public.begin_account_deletion(uuid) to service_role;
grant execute on function public.advance_account_deletion(uuid, text, text, text, text)
  to service_role;
grant execute on function public.reconcile_completed_account_deletions(integer)
  to service_role;

comment on table public.account_deletion_jobs is
  'Service-only durable erasure receipts. No user FK by design: the row survives auth/profile cascade for retries and reconciliation.';
comment on function public.begin_account_deletion(uuid) is
  'Service-only, retry-safe account containment and deletion-job claim.';
comment on function public.advance_account_deletion(uuid, text, text, text, text) is
  'Service-only monotonic checkpoint/error receipt for billing, media, and identity erasure.';
comment on function public.reconcile_completed_account_deletions(integer) is
  'Service-only bounded reconciliation for media-complete jobs whose Auth identity is already absent.';
