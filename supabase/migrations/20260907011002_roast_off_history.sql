-- Live media and current room state remain outside Postgres. Store only short,
-- expiring battle summaries; the application worker deletes expired rows.
create table public.roast_battle_results (
  id uuid primary key,
  room_id text not null,
  visibility text not null,
  performer_names jsonb not null,
  result jsonb not null,
  ended_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint roast_results_room_format check (
    room_id = 'main' or room_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint roast_results_visibility check (visibility in ('public', 'private')),
  constraint roast_results_performers check (
    jsonb_typeof(performer_names) = 'array'
    and jsonb_array_length(performer_names) = 2
    and jsonb_typeof(performer_names -> 0) = 'string'
    and jsonb_typeof(performer_names -> 1) = 'string'
    and char_length(performer_names ->> 0) between 1 and 80
    and char_length(performer_names ->> 1) between 1 and 80
  ),
  constraint roast_results_summary check (
    jsonb_typeof(result) = 'object' and octet_length(result::text) <= 16384
  ),
  constraint roast_results_expiry check (
    expires_at > ended_at and expires_at <= ended_at + interval '30 days'
  )
);
create index roast_results_expiry_idx on public.roast_battle_results (expires_at);
alter table public.roast_battle_results enable row level security;
revoke all on public.roast_battle_results from public, anon, authenticated;
grant select, insert, update, delete on public.roast_battle_results to service_role;
comment on table public.roast_battle_results is
  'Server-only, at most one summary per battle. No media, account IDs, or guest hashes. Expired summaries are deleted by the live room worker.';

-- A live room/member is an explicit report target, including guest incidents.
-- The API verifies current room membership; ephemeral member IDs have no FK.
alter table public.reports
  add column roast_room_id text,
  add column roast_member_id uuid,
  drop constraint reports_one_target,
  add constraint reports_one_target check (
    num_nonnulls(delivery_id, profile_id, prompt_id, submission_id, roast_room_id) = 1
  ),
  add constraint reports_roast_room_format check (
    roast_room_id is null or roast_room_id = 'main'
    or roast_room_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  add constraint reports_roast_member_room check (
    roast_member_id is null or roast_room_id is not null
  );
create index reports_roast_room_idx on public.reports (roast_room_id, created_at desc)
  where roast_room_id is not null;

-- Preserve a normal moderation audit trail for manual room-report triage.
alter table public.moderation_actions
  add column roast_room_id text,
  add column roast_member_id uuid,
  drop constraint moderation_actions_target,
  add constraint moderation_actions_target check (
    num_nonnulls(subject_user_id, delivery_id, prompt_id, submission_id, roast_room_id) >= 1
  ),
  add constraint moderation_actions_roast_room_format check (
    roast_room_id is null or roast_room_id = 'main'
    or roast_room_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  add constraint moderation_actions_roast_member_room check (
    roast_member_id is null or roast_room_id is not null
  );

-- This performs review bookkeeping only. Host mute/remove/ban permissions and
-- immediate media revocation belong to the live room control plane.
grant select on public.profiles to service_role;
grant select, insert, update on public.reports to service_role;
grant select, insert on public.moderation_actions to service_role;
create function public.resolve_roast_report(
  p_report_id uuid,
  p_actor_id uuid,
  p_decision public.moderation_decision,
  p_reason text,
  p_internal_note text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_report public.reports;
  created_action_id uuid;
  next_state public.report_state;
begin
  if current_user <> 'service_role' then
    raise exception using errcode = '42501', message = 'Only the trusted service may review live room reports';
  end if;
  if not exists (
    select 1 from public.profiles where id = p_actor_id and role in ('moderator', 'admin')
  ) then
    raise exception using errcode = '42501', message = 'Moderation actor must be a moderator or admin';
  end if;
  if p_decision is null or p_decision not in ('allow', 'limit') then
    raise exception using errcode = '22023', message = 'Live room reports support manual triage or dismissal; enforcement is in the live room';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500
     or (p_internal_note is not null and char_length(p_internal_note) > 2000) then
    raise exception using errcode = '22023', message = 'A valid review reason and bounded internal note are required';
  end if;

  select * into target_report from public.reports where id = p_report_id for update;
  if not found or target_report.roast_room_id is null then
    raise exception using errcode = '23503', message = 'Live room report not found';
  end if;
  if target_report.state not in ('open', 'triaged')
     or (target_report.state = 'triaged' and p_decision = 'limit') then
    raise exception using errcode = '55000', message = 'This live room report was already reviewed';
  end if;

  next_state := case when p_decision = 'allow' then 'dismissed' else 'triaged' end;
  insert into public.moderation_actions (
    report_id, actor_id, roast_room_id, roast_member_id, decision, reason, internal_note
  ) values (
    target_report.id, p_actor_id, target_report.roast_room_id, target_report.roast_member_id,
    p_decision, btrim(p_reason), nullif(btrim(p_internal_note), '')
  ) returning id into created_action_id;
  update public.reports
    set state = next_state, assigned_to = p_actor_id,
        resolved_at = case when next_state = 'dismissed' then now() else null end
    where id = target_report.id;
  return jsonb_build_object(
    'actionId', created_action_id, 'reportId', target_report.id,
    'targetType', 'roast', 'state', next_state, 'manualReviewOnly', true
  );
end;
$$;
revoke all on function public.resolve_roast_report(uuid, uuid, public.moderation_decision, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_roast_report(uuid, uuid, public.moderation_decision, text, text)
  to service_role;
comment on function public.resolve_roast_report(uuid, uuid, public.moderation_decision, text, text) is
  'Service-only staff review. limit means manual triage only, never a claimed live mute, ban, or media removal.';
