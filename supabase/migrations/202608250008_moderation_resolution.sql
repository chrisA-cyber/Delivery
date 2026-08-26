-- Atomic, auditable moderation decisions for a protected staff workflow.

-- Profile moderation must survive a later account edit. These restrictions are
-- deliberately enforced for every writer, including trusted account endpoints;
-- staff must remove the durable restriction before restoring a contained profile.
create or replace function public.enforce_profile_moderation_containment()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  has_profile_limit boolean;
  has_profile_remove boolean;
begin
  select
    coalesce(pg_catalog.bool_or(r.kind = 'profile-limit'), false),
    coalesce(pg_catalog.bool_or(r.kind = 'profile-remove'), false)
  into has_profile_limit, has_profile_remove
  from public.account_restrictions r
  where r.user_id = new.id
    and r.starts_at <= now()
    and (r.ends_at is null or r.ends_at > now())
    and r.kind in ('profile-limit', 'profile-remove');

  if has_profile_remove then
    new.is_private := true;
    new.display_name := 'Player';
    new.bio := null;
    new.avatar_path := null;
  elsif has_profile_limit then
    new.is_private := true;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_moderation_containment on public.profiles;
create trigger profiles_enforce_moderation_containment
  before update of display_name, avatar_path, bio, is_private on public.profiles
  for each row execute function public.enforce_profile_moderation_containment();

-- A prompt decision also contains every performance derived from that line. The
-- source recording and score stay available to the owner/staff as evidence, while
-- public surfaces and derived share references are revoked in the same transaction.
create or replace function public.contain_prompt_deliveries(
  p_prompt_id uuid,
  p_remove boolean
)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid;
  revoked_paths text[];
begin
  select coalesce(
    pg_catalog.array_agg(distinct d.share_asset_path order by d.share_asset_path)
      filter (where d.share_asset_path is not null),
    '{}'::text[]
  )
  into revoked_paths
  from public.deliveries d
  where d.prompt_id = p_prompt_id;

  if p_remove then
    update public.deliveries d
    set state = 'removed',
        visibility = 'private',
        published_at = null,
        share_asset_path = null,
        failure_code = 'moderation-prompt-removed',
        moderation_labels = pg_catalog.array_append(
          pg_catalog.array_append(
            pg_catalog.array_remove(
              pg_catalog.array_remove(
                pg_catalog.array_remove(
                  pg_catalog.array_remove(
                    pg_catalog.array_remove(
                      pg_catalog.array_remove(d.moderation_labels, 'publish-approved'),
                      'publish-review'
                    ),
                    'publish-limited'
                  ),
                  'moderator-limited'
                ),
                'publish-rejected'
              ),
              'moderator-removed'
            ),
            'publish-rejected'
          ),
          'moderator-removed'
        )
    where d.prompt_id = p_prompt_id;
  else
    update public.deliveries d
    set visibility = 'private',
        published_at = null,
        share_asset_path = null,
        moderation_labels = case
          when d.state = 'removed' then d.moderation_labels
          else pg_catalog.array_append(
            pg_catalog.array_append(
              pg_catalog.array_remove(
                pg_catalog.array_remove(
                  pg_catalog.array_remove(
                    pg_catalog.array_remove(d.moderation_labels, 'publish-approved'),
                    'publish-review'
                  ),
                  'publish-limited'
                ),
                'moderator-limited'
              ),
              'publish-limited'
            ),
            'moderator-limited'
          )
        end
    where d.prompt_id = p_prompt_id;
  end if;

  for affected_user_id in
    select distinct d.user_id
    from public.deliveries d
    where d.prompt_id = p_prompt_id
    order by d.user_id
  loop
    perform public.refresh_user_rollups(affected_user_id);
  end loop;

  perform public.refresh_prompt_stats(p_prompt_id);
  return revoked_paths;
end;
$$;

-- Even if a trusted writer races a moderation decision, an unpublished prompt
-- or actively contained profile can never be republished through a raw row write.
create or replace function public.enforce_delivery_publication_boundary()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.visibility = 'public' then
    if not exists (
      select 1
      from public.prompts p
      where p.id = new.prompt_id and p.state = 'published'
    ) then
      raise exception using
        errcode = '42501',
        message = 'Deliveries for an unpublished prompt cannot be public';
    end if;

    if public.has_active_restriction(new.user_id, 'profile-limit')
       or public.has_active_restriction(new.user_id, 'profile-remove') then
      raise exception using
        errcode = '42501',
        message = 'A contained profile cannot publish deliveries';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists deliveries_enforce_publication_boundary on public.deliveries;
create trigger deliveries_enforce_publication_boundary
  before insert or update of visibility, prompt_id, user_id on public.deliveries
  for each row execute function public.enforce_delivery_publication_boundary();

-- Non-owner/non-staff reads fail closed for unpublished prompts and profiles with
-- an active moderation restriction, including challenge and stream side channels.
create or replace function public.can_view_delivery(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.profiles p on p.id = d.user_id
    join public.prompts pr on pr.id = d.prompt_id
    where d.id = p_delivery_id
      and (
        d.user_id = (select auth.uid())
        or public.is_staff()
        or (
          pr.state = 'published'
          and not public.has_active_restriction(d.user_id, 'profile-limit')
          and not public.has_active_restriction(d.user_id, 'profile-remove')
          and not exists (
            select 1
            from public.blocks b
            where (b.blocker_id = d.user_id and b.blocked_id = (select auth.uid()))
               or (b.blocker_id = (select auth.uid()) and b.blocked_id = d.user_id)
          )
          and (
            (
              d.state = 'judged'
              and (select auth.uid()) is not null
              and d.challenge_id is not null
              and exists (
                select 1
                from public.challenges c
                where c.id = d.challenge_id
                  and (c.created_by = (select auth.uid()) or c.recipient_user_id = (select auth.uid()))
              )
            )
            or (
              d.state = 'judged'
              and (select auth.uid()) is not null
              and d.stream_session_id is not null
              and exists (
                select 1
                from public.stream_sessions ss
                where ss.id = d.stream_session_id and ss.host_id = (select auth.uid())
              )
            )
            or (
              d.state = 'judged'
              and d.visibility = 'public'
              and (
                not p.is_private
                or exists (
                  select 1
                  from public.follows f
                  where f.follower_id = (select auth.uid()) and f.following_id = p.id
                )
              )
            )
          )
        )
      )
  );
$$;

revoke all on function public.enforce_profile_moderation_containment()
  from public, anon, authenticated, service_role;
revoke all on function public.contain_prompt_deliveries(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_delivery_publication_boundary()
  from public, anon, authenticated, service_role;

create or replace function public.resolve_moderation_report(
  p_report_id uuid,
  p_actor_id uuid,
  p_decision public.moderation_decision,
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
  caller_role text := auth.role();
  actor_role public.app_role;
  target_report public.reports;
  target_delivery public.deliveries;
  target_profile public.profiles;
  target_prompt public.prompts;
  target_submission public.line_submissions;
  propagated_prompt public.prompts;
  propagated_prompt_id uuid;
  propagated_prompt_state text;
  target_subject_id uuid;
  target_type text;
  target_state text;
  created_action_id uuid;
  resolved_state public.report_state;
  resolved_at_value timestamptz;
  revoked_share_asset_path text;
  revoked_share_asset_paths text[] := '{}'::text[];
  revoked_avatar_path text;
begin
  if caller_role is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Only the trusted service may resolve moderation reports';
  end if;

  if p_actor_id is null then
    raise exception using errcode = '22023', message = 'A moderation actor is required';
  end if;

  select p.role into actor_role
  from public.profiles p
  where p.id = p_actor_id;

  if not found or actor_role not in ('moderator', 'admin') then
    raise exception using
      errcode = '42501',
      message = 'Moderation actor must be a moderator or admin';
  end if;

  if p_decision is null or p_decision not in ('allow', 'limit', 'remove') then
    raise exception using
      errcode = '22023',
      message = 'Moderation decision must be allow, limit, or remove';
  end if;

  if p_reason is null
     or char_length(pg_catalog.btrim(p_reason)) not between 3 and 500 then
    raise exception using
      errcode = '22023',
      message = 'Moderation reason must contain 3 to 500 characters';
  end if;

  if p_internal_note is not null and char_length(p_internal_note) > 2000 then
    raise exception using
      errcode = '22023',
      message = 'Moderation internal note must be at most 2000 characters';
  end if;

  select r.* into target_report
  from public.reports r
  where r.id = p_report_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'Moderation report not found';
  end if;

  if target_report.state not in ('open', 'triaged') then
    raise exception using errcode = '55000', message = 'Moderation report is already resolved';
  end if;

  if target_report.delivery_id is not null then
    select d.* into target_delivery
    from public.deliveries d
    where d.id = target_report.delivery_id
    for update;
    target_subject_id := target_delivery.user_id;
    target_type := 'delivery';
    target_state := target_delivery.state::text;
    revoked_share_asset_path := target_delivery.share_asset_path;
    if revoked_share_asset_path is not null then
      revoked_share_asset_paths := array[revoked_share_asset_path];
    end if;
  elsif target_report.profile_id is not null then
    -- Match the account-deletion/social mutation lock namespace used by later
    -- hardening migrations. Taking it before the profile row lock gives every
    -- profile-containment race the same account -> row lock order.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'delivery-account-delete:' || target_report.profile_id::text,
        0
      )
    );
    select p.* into target_profile
    from public.profiles p
    where p.id = target_report.profile_id
    for update;
    target_subject_id := target_profile.id;
    target_type := 'profile';
    target_state := case when target_profile.is_private then 'private' else 'public' end;
    revoked_avatar_path := target_profile.avatar_path;
  elsif target_report.prompt_id is not null then
    select p.* into target_prompt
    from public.prompts p
    where p.id = target_report.prompt_id
    for update;
    target_type := 'prompt';
    target_state := target_prompt.state::text;
  elsif target_report.submission_id is not null then
    select s.* into target_submission
    from public.line_submissions s
    where s.id = target_report.submission_id
    for update;
    target_subject_id := target_submission.submitted_by;
    target_type := 'submission';
    target_state := target_submission.state::text;

    if p_decision in ('limit', 'remove')
       and target_submission.promoted_prompt_id is not null then
      propagated_prompt_id := target_submission.promoted_prompt_id;
      select p.* into propagated_prompt
      from public.prompts p
      where p.id = propagated_prompt_id
      for update;
    end if;
  end if;

  insert into public.moderation_actions (
    report_id,
    actor_id,
    subject_user_id,
    delivery_id,
    prompt_id,
    submission_id,
    decision,
    reason,
    internal_note
  )
  values (
    target_report.id,
    p_actor_id,
    target_subject_id,
    target_report.delivery_id,
    coalesce(target_report.prompt_id, propagated_prompt_id),
    target_report.submission_id,
    p_decision,
    pg_catalog.btrim(p_reason),
    nullif(pg_catalog.btrim(p_internal_note), '')
  )
  returning id into created_action_id;

  if target_report.profile_id is not null and p_decision in ('limit', 'remove') then
    insert into public.account_restrictions (
      user_id,
      action_id,
      kind,
      reason
    )
    values (
      target_report.profile_id,
      created_action_id,
      case when p_decision = 'remove' then 'profile-remove' else 'profile-limit' end,
      pg_catalog.btrim(p_reason)
    );
  end if;

  if target_report.delivery_id is not null and p_decision = 'limit' then
    update public.deliveries d
    set visibility = 'private',
        published_at = null,
        share_asset_path = null,
        moderation_labels = pg_catalog.array_append(
          pg_catalog.array_append(
            pg_catalog.array_remove(
              pg_catalog.array_remove(
                pg_catalog.array_remove(
                  pg_catalog.array_remove(d.moderation_labels, 'publish-approved'),
                  'publish-review'
                ),
                'publish-limited'
              ),
              'moderator-limited'
            ),
            'publish-limited'
          ),
          'moderator-limited'
        )
    where d.id = target_report.delivery_id;
  elsif target_report.delivery_id is not null and p_decision = 'remove' then
    update public.deliveries d
    set state = 'removed',
        visibility = 'private',
        published_at = null,
        share_asset_path = null,
        failure_code = 'moderation-removed',
        moderation_labels = pg_catalog.array_append(
          pg_catalog.array_append(
            pg_catalog.array_remove(
              pg_catalog.array_remove(
                pg_catalog.array_remove(
                  pg_catalog.array_remove(
                    pg_catalog.array_remove(
                      pg_catalog.array_remove(d.moderation_labels, 'publish-approved'),
                      'publish-review'
                    ),
                    'publish-limited'
                  ),
                  'moderator-limited'
                ),
                'publish-rejected'
              ),
              'moderator-removed'
            ),
            'publish-rejected'
          ),
          'moderator-removed'
        )
    where d.id = target_report.delivery_id;
  elsif target_report.profile_id is not null and p_decision = 'limit' then
    update public.profiles p
    set is_private = true
    where p.id = target_report.profile_id;

    delete from public.follows f
    where f.follower_id = target_report.profile_id
       or f.following_id = target_report.profile_id;
  elsif target_report.profile_id is not null and p_decision = 'remove' then
    update public.profiles p
    set is_private = true,
        bio = null,
        display_name = 'Player',
        avatar_path = null
    where p.id = target_report.profile_id;

    delete from public.follows f
    where f.follower_id = target_report.profile_id
       or f.following_id = target_report.profile_id;
  elsif target_report.prompt_id is not null and p_decision = 'limit' then
    update public.prompts p
    set state = 'review'
    where p.id = target_report.prompt_id;

    revoked_share_asset_paths := public.contain_prompt_deliveries(
      target_report.prompt_id,
      false
    );
  elsif target_report.prompt_id is not null and p_decision = 'remove' then
    update public.prompts p
    set state = 'archived'
    where p.id = target_report.prompt_id;

    revoked_share_asset_paths := public.contain_prompt_deliveries(
      target_report.prompt_id,
      true
    );
  elsif target_report.submission_id is not null and p_decision = 'limit' then
    update public.line_submissions s
    set state = 'review',
        reviewed_by = p_actor_id,
        reviewed_at = now()
    where s.id = target_report.submission_id;

    if propagated_prompt_id is not null then
      update public.prompts p
      set state = 'review'
      where p.id = propagated_prompt_id;

      revoked_share_asset_paths := public.contain_prompt_deliveries(
        propagated_prompt_id,
        false
      );
    end if;
  elsif target_report.submission_id is not null and p_decision = 'remove' then
    update public.line_submissions s
    set state = 'rejected',
        reviewed_by = p_actor_id,
        reviewed_at = now()
    where s.id = target_report.submission_id;

    if propagated_prompt_id is not null then
      update public.prompts p
      set state = 'archived'
      where p.id = propagated_prompt_id;

      revoked_share_asset_paths := public.contain_prompt_deliveries(
        propagated_prompt_id,
        true
      );
    end if;
  end if;

  if target_report.delivery_id is not null and p_decision in ('limit', 'remove') then
    select d.* into target_delivery
    from public.deliveries d
    where d.id = target_report.delivery_id;

    perform public.refresh_user_rollups(target_delivery.user_id);
    perform public.refresh_prompt_stats(target_delivery.prompt_id);
    target_state := target_delivery.state::text;
  elsif target_report.profile_id is not null and p_decision in ('limit', 'remove') then
    select p.* into target_profile
    from public.profiles p
    where p.id = target_report.profile_id;
    target_state := case when target_profile.is_private then 'private' else 'public' end;
  elsif target_report.prompt_id is not null and p_decision in ('limit', 'remove') then
    select p.* into target_prompt
    from public.prompts p
    where p.id = target_report.prompt_id;
    target_state := target_prompt.state::text;
  elsif target_report.submission_id is not null and p_decision in ('limit', 'remove') then
    select s.* into target_submission
    from public.line_submissions s
    where s.id = target_report.submission_id;
    target_state := target_submission.state::text;

    if propagated_prompt_id is not null then
      select p.* into propagated_prompt
      from public.prompts p
      where p.id = propagated_prompt_id;
      propagated_prompt_state := propagated_prompt.state::text;
    end if;
  end if;

  update public.reports r
  set state = case
        when p_decision = 'allow' then 'dismissed'::public.report_state
        else 'actioned'::public.report_state
      end,
      assigned_to = p_actor_id,
      resolved_at = now(),
      updated_at = now()
  where r.id = target_report.id
  returning r.state, r.resolved_at into resolved_state, resolved_at_value;

  return pg_catalog.jsonb_build_object(
    'reportId', target_report.id,
    'state', resolved_state,
    'actionId', created_action_id,
    'decision', p_decision,
    'targetType', target_type,
    'targetState', target_state,
    'deliveryId', target_report.delivery_id,
    'deliveryState', case
      when target_report.delivery_id is null then null
      else target_delivery.state::text
    end,
    'deliveryVisibility', case
      when target_report.delivery_id is null then null
      else target_delivery.visibility::text
    end,
    'revokedShareAssetPath', case
      when target_report.delivery_id is null or p_decision = 'allow' then null
      else revoked_share_asset_path
    end,
    'revokedShareAssetPaths', case
      when p_decision = 'allow' then pg_catalog.to_jsonb('{}'::text[])
      else pg_catalog.to_jsonb(revoked_share_asset_paths)
    end,
    'revokedAvatarPath', case
      when target_report.profile_id is null or p_decision <> 'remove' then null
      else revoked_avatar_path
    end,
    'propagatedPromptId', propagated_prompt_id,
    'propagatedPromptState', propagated_prompt_state,
    'resolvedAt', resolved_at_value
  );
end;
$$;

-- Staff browsers retain RLS-scoped queue/audit reads. All decisions and audit
-- writes go through the server RPC so report state and containment cannot diverge.
drop policy if exists "staff manage reports" on public.reports;
revoke update on public.reports from authenticated;

drop policy if exists "staff create moderation actions" on public.moderation_actions;
revoke insert on public.moderation_actions from authenticated;

drop policy if exists "staff manage restrictions" on public.account_restrictions;
revoke insert, update, delete on public.account_restrictions from authenticated;

-- Profile edits use the trusted account API after it authenticates the caller and
-- applies moderation/rate-limit checks. Direct browser updates could immediately
-- undo a profile containment.
drop policy if exists "users update own profile" on public.profiles;
revoke update (
  handle, display_name, avatar_path, bio, is_private, locale, last_active_at
) on public.profiles from authenticated;

-- Share derivatives are never anonymously addressable. Server loaders can issue
-- short-lived signed URLs after the same delivery-visibility check used for audio.
update storage.buckets
set public = false
where id = 'delivery-share';

drop policy if exists "public reads share assets" on storage.objects;

revoke all on function public.resolve_moderation_report(
  uuid, uuid, public.moderation_decision, text, text
) from public, anon, authenticated;
grant execute on function public.resolve_moderation_report(
  uuid, uuid, public.moderation_decision, text, text
) to service_role;

comment on function public.resolve_moderation_report(
  uuid, uuid, public.moderation_decision, text, text
) is
  'Service-only atomic report resolution. Validates staff actor, records an audit action, resolves the report, and immediately contains delivery, profile, prompt, or submission targets for limit/remove.';

comment on function public.enforce_profile_moderation_containment() is
  'Internal invariant trigger. Active profile-limit/profile-remove restrictions survive every later profile update until staff removes the restriction.';
comment on function public.contain_prompt_deliveries(uuid, boolean) is
  'Internal prompt propagation helper. Quarantines derived deliveries, revokes share references, and refreshes affected rollups atomically.';
