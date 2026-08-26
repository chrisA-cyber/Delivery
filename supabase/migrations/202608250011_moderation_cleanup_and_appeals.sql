-- Durable media erasure for atomic moderation containment, plus an audited,
-- service-only path for staff to lift profile restrictions after review/appeal.

create table public.moderation_storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.moderation_actions(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  state text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint moderation_cleanup_bucket check (bucket in ('delivery-share', 'avatars')),
  constraint moderation_cleanup_path check (
    char_length(object_path) between 3 and 512
    and object_path !~ '[[:cntrl:]]'
    and pg_catalog.strpos(object_path, pg_catalog.chr(92)) = 0
  ),
  constraint moderation_cleanup_state check (
    state in ('pending', 'processing', 'retry', 'completed', 'dead')
  ),
  constraint moderation_cleanup_attempts check (attempt_count between 0 and 10),
  constraint moderation_cleanup_error check (
    last_error_code is null or char_length(last_error_code) between 1 and 80
  ),
  constraint moderation_cleanup_completion check (
    (state = 'completed') = (completed_at is not null)
  ),
  unique (action_id, bucket, object_path)
);

create index moderation_cleanup_claim_idx
  on public.moderation_storage_cleanup_jobs (state, next_attempt_at, lease_until, created_at)
  where state in ('pending', 'processing', 'retry');

alter table public.moderation_storage_cleanup_jobs enable row level security;
create trigger moderation_storage_cleanup_jobs_set_updated_at
  before update on public.moderation_storage_cleanup_jobs
  for each row execute function public.set_updated_at();

revoke all on table public.moderation_storage_cleanup_jobs from public, anon, authenticated;
grant select, insert, update on table public.moderation_storage_cleanup_jobs to service_role;

create or replace function public.enqueue_moderation_storage_cleanup()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.decision not in ('limit', 'remove') then
    return new;
  end if;

  if new.delivery_id is not null then
    insert into public.moderation_storage_cleanup_jobs (action_id, bucket, object_path)
    select new.id, 'delivery-share', d.share_asset_path
    from public.deliveries d
    where d.id = new.delivery_id and d.share_asset_path is not null
    on conflict (action_id, bucket, object_path) do nothing;
  end if;

  -- Prompt IDs are present for a directly-reported prompt and for a promoted
  -- submission. Capture every derivative before the resolution RPC nulls paths.
  if new.prompt_id is not null then
    insert into public.moderation_storage_cleanup_jobs (action_id, bucket, object_path)
    select new.id, 'delivery-share', d.share_asset_path
    from public.deliveries d
    where d.prompt_id = new.prompt_id and d.share_asset_path is not null
    on conflict (action_id, bucket, object_path) do nothing;
  end if;

  if new.decision = 'remove' and new.report_id is not null then
    insert into public.moderation_storage_cleanup_jobs (action_id, bucket, object_path)
    select new.id, 'avatars', p.avatar_path
    from public.reports r
    join public.profiles p on p.id = r.profile_id
    where r.id = new.report_id
      and r.profile_id is not null
      and p.avatar_path is not null
    on conflict (action_id, bucket, object_path) do nothing;
  end if;

  return new;
end;
$$;

create trigger moderation_actions_enqueue_storage_cleanup
  after insert on public.moderation_actions
  for each row execute function public.enqueue_moderation_storage_cleanup();

create or replace function public.claim_moderation_storage_cleanup(
  p_limit integer default 100,
  p_lease_seconds integer default 120
)
returns table (
  job_id uuid,
  bucket text,
  object_path text,
  attempt_count integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may claim moderation cleanup';
  end if;
  if p_limit not between 1 and 100 or p_lease_seconds not between 30 and 900 then
    raise exception using errcode = '22023', message = 'Invalid moderation cleanup lease';
  end if;

  return query
  with candidates as (
    select j.id
    from public.moderation_storage_cleanup_jobs j
    where (j.state in ('pending', 'retry') and j.next_attempt_at <= now())
       or (j.state = 'processing' and j.lease_until < now())
    order by j.created_at, j.id
    for update skip locked
    limit p_limit
  )
  update public.moderation_storage_cleanup_jobs j
  set state = 'processing',
      attempt_count = least(j.attempt_count + 1, 10),
      lease_until = now() + pg_catalog.make_interval(secs => p_lease_seconds),
      last_error_code = null
  from candidates c
  where j.id = c.id
  returning j.id, j.bucket, j.object_path, j.attempt_count;
end;
$$;

create or replace function public.finish_moderation_storage_cleanup(
  p_job_ids uuid[],
  p_success boolean,
  p_error_code text default null
)
returns table (updated integer, dead integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  updated_count integer := 0;
  dead_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may finish moderation cleanup';
  end if;
  if p_job_ids is null or cardinality(p_job_ids) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Invalid moderation cleanup job batch';
  end if;
  if not p_success and (p_error_code is null or char_length(p_error_code) not between 1 and 80) then
    raise exception using errcode = '22023', message = 'Failed cleanup requires a safe error code';
  end if;

  update public.moderation_storage_cleanup_jobs j
  set state = case
        when p_success then 'completed'
        when j.attempt_count >= 10 then 'dead'
        else 'retry'
      end,
      lease_until = null,
      next_attempt_at = case
        when p_success then j.next_attempt_at
        when j.attempt_count >= 10 then j.next_attempt_at
        else now() + pg_catalog.make_interval(
          secs => least(
            3600,
            (30 * pg_catalog.power(2::numeric, greatest(j.attempt_count - 1, 0)))::integer
          )
        )
      end,
      last_error_code = case when p_success then null else pg_catalog.left(p_error_code, 80) end,
      completed_at = case when p_success then now() else null end
  where j.id = any(p_job_ids)
    and j.state = 'processing';
  get diagnostics updated_count = row_count;

  select count(*)::integer into dead_count
  from public.moderation_storage_cleanup_jobs j
  where j.id = any(p_job_ids) and j.state = 'dead';
  return query select updated_count, dead_count;
end;
$$;

create or replace function public.lift_moderation_restriction(
  p_restriction_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_internal_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_role public.app_role;
  target public.account_restrictions;
  lift_action_id uuid;
  remaining_active integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may lift moderation restrictions';
  end if;
  select p.role into actor_role from public.profiles p where p.id = p_actor_id;
  if not found or actor_role not in ('moderator', 'admin') then
    raise exception using errcode = '42501', message = 'Restriction lift requires moderator or admin';
  end if;
  if p_reason is null or char_length(pg_catalog.btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'Lift reason must contain 3 to 500 characters';
  end if;
  if p_internal_note is not null and char_length(p_internal_note) > 2000 then
    raise exception using errcode = '22023', message = 'Lift internal note must be at most 2000 characters';
  end if;

  select r.* into target
  from public.account_restrictions r
  where r.id = p_restriction_id
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'Moderation restriction not found';
  end if;
  if target.kind not in ('profile-limit', 'profile-remove') or target.action_id is null then
    raise exception using errcode = '0A000', message = 'This restriction requires a dedicated operations workflow';
  end if;
  if target.ends_at is not null and target.ends_at <= now() then
    raise exception using errcode = '55000', message = 'Moderation restriction is already inactive';
  end if;

  update public.account_restrictions r
  set ends_at = greatest(pg_catalog.clock_timestamp(), r.starts_at + interval '1 microsecond')
  where r.id = target.id;

  insert into public.moderation_actions (
    actor_id, subject_user_id, decision, reason, internal_note
  ) values (
    p_actor_id,
    target.user_id,
    'allow',
    'Restriction lifted: ' || pg_catalog.btrim(p_reason),
    nullif(pg_catalog.btrim(p_internal_note), '')
  )
  returning id into lift_action_id;

  select count(*)::integer into remaining_active
  from public.account_restrictions r
  where r.user_id = target.user_id
    and r.kind in ('profile-limit', 'profile-remove')
    and r.starts_at <= pg_catalog.clock_timestamp()
    and (r.ends_at is null or r.ends_at > pg_catalog.clock_timestamp());

  return pg_catalog.jsonb_build_object(
    'restrictionId', target.id,
    'userId', target.user_id,
    'kind', target.kind,
    'liftActionId', lift_action_id,
    'remainingActiveProfileRestrictions', remaining_active,
    'liftedAt', pg_catalog.clock_timestamp()
  );
end;
$$;

revoke all on function public.enqueue_moderation_storage_cleanup()
  from public, anon, authenticated, service_role;
revoke all on function public.claim_moderation_storage_cleanup(integer, integer)
  from public, anon, authenticated;
revoke all on function public.finish_moderation_storage_cleanup(uuid[], boolean, text)
  from public, anon, authenticated;
revoke all on function public.lift_moderation_restriction(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_moderation_storage_cleanup(integer, integer)
  to service_role;
grant execute on function public.finish_moderation_storage_cleanup(uuid[], boolean, text)
  to service_role;
grant execute on function public.lift_moderation_restriction(uuid, uuid, text, text)
  to service_role;

comment on table public.moderation_storage_cleanup_jobs is
  'Durable moderation outbox for revoked public avatars and share derivatives. Jobs are inserted in the same transaction as the audit action.';
comment on function public.lift_moderation_restriction(uuid, uuid, text, text) is
  'Service-only audited lift for active profile moderation restrictions; does not restore removed content or public visibility automatically.';
