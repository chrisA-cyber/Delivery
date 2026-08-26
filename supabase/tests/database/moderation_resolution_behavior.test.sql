begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(36);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('88888888-8888-4888-8888-888888888881', 'mod@example.test', '{"user_name":"mod_fixture"}'::jsonb, now(), now()),
  ('88888888-8888-4888-8888-888888888882', 'not-mod@example.test', '{"user_name":"not_mod_fixture"}'::jsonb, now(), now()),
  ('88888888-8888-4888-8888-888888888883', 'reporter@example.test', '{"user_name":"reporter_fixture"}'::jsonb, now(), now()),
  ('88888888-8888-4888-8888-888888888884', 'delivery-owner@example.test', '{"user_name":"delivery_owner"}'::jsonb, now(), now()),
  ('88888888-8888-4888-8888-888888888885', 'profile-limit@example.test', '{"user_name":"profile_limit"}'::jsonb, now(), now()),
  ('88888888-8888-4888-8888-888888888886', 'profile-remove@example.test', '{"user_name":"profile_remove"}'::jsonb, now(), now()),
  ('88888888-8888-4888-8888-888888888887', 'submitter@example.test', '{"user_name":"submitter_fixture"}'::jsonb, now(), now());

update public.profiles
set role = 'moderator'
where id = '88888888-8888-4888-8888-888888888881';

update public.profiles
set display_name = case
      when id = '88888888-8888-4888-8888-888888888885' then 'Limited Display'
      else 'Removed Display'
    end,
    bio = 'A profile bio that should be preserved only for limit.',
    avatar_path = id::text || '/moderation-avatar.png'
where id in (
  '88888888-8888-4888-8888-888888888885',
  '88888888-8888-4888-8888-888888888886'
);

insert into public.follows (follower_id, following_id)
values
  ('88888888-8888-4888-8888-888888888883', '88888888-8888-4888-8888-888888888885'),
  ('88888888-8888-4888-8888-888888888885', '88888888-8888-4888-8888-888888888883'),
  ('88888888-8888-4888-8888-888888888883', '88888888-8888-4888-8888-888888888886'),
  ('88888888-8888-4888-8888-888888888886', '88888888-8888-4888-8888-888888888883');

insert into public.deliveries (
  id, user_id, prompt_id, state, visibility,
  recording_path, share_asset_path, moderation_labels, scored_at
)
select
  d.delivery_id,
  '88888888-8888-4888-8888-888888888884',
  p.id,
  'processing',
  'private',
  '88888888-8888-4888-8888-888888888884/' || d.delivery_id::text || '.wav',
  d.share_path,
  array['publish-approved'],
  now()
from public.prompts p
cross join (
  values
    ('99999999-9999-4999-8999-999999999901'::uuid, 'moderation/limit-card.png'::text),
    ('99999999-9999-4999-8999-999999999902'::uuid, 'moderation/remove-card.png'::text)
) as d(delivery_id, share_path)
where p.slug = 'timeline-needs-me';

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values
  ('99999999-9999-4999-8999-999999999901', 80, 80, 80, 80, 80, 'Limit fixture', 'Quarantine this result.', 'test-v1', 'test', 'test'),
  ('99999999-9999-4999-8999-999999999902', 81, 81, 81, 81, 81, 'Remove fixture', 'Remove this result.', 'test-v1', 'test', 'test');

insert into public.deliveries (
  id, user_id, prompt_id, state, visibility,
  recording_path, share_asset_path, moderation_labels, scored_at
)
select
  d.delivery_id,
  '88888888-8888-4888-8888-888888888884',
  p.id,
  'processing',
  'private',
  '88888888-8888-4888-8888-888888888884/' || d.delivery_id::text || '.wav',
  d.share_path,
  array['publish-approved'],
  now()
from (
  values
    ('99999999-9999-4999-8999-999999999903'::uuid, 'calendar-hostile'::text, 'moderation/prompt-limit-card.png'::text),
    ('99999999-9999-4999-8999-999999999904'::uuid, 'doom-calendar'::text, 'moderation/prompt-remove-card.png'::text),
    ('99999999-9999-4999-8999-999999999905'::uuid, 'reply-all-event'::text, 'moderation/submission-limit-card.png'::text),
    ('99999999-9999-4999-8999-999999999906'::uuid, 'cape-dry-clean'::text, 'moderation/submission-remove-card.png'::text)
) as d(delivery_id, slug, share_path)
join public.prompts p on p.slug = d.slug;

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values
  ('99999999-9999-4999-8999-999999999903', 82, 82, 82, 82, 82, 'Prompt limit fixture', 'Contain the reported prompt.', 'test-v1', 'test', 'test'),
  ('99999999-9999-4999-8999-999999999904', 83, 83, 83, 83, 83, 'Prompt remove fixture', 'Remove the reported prompt.', 'test-v1', 'test', 'test'),
  ('99999999-9999-4999-8999-999999999905', 84, 84, 84, 84, 84, 'Promoted limit fixture', 'Contain the promoted prompt.', 'test-v1', 'test', 'test'),
  ('99999999-9999-4999-8999-999999999906', 85, 85, 85, 85, 85, 'Promoted remove fixture', 'Remove the promoted prompt.', 'test-v1', 'test', 'test');

insert into public.line_submissions (
  id, submitted_by, proposed_body, state
)
values
  ('abababab-abab-4bab-8bab-ababababab01', '88888888-8888-4888-8888-888888888887', 'Submission that returns to review.', 'published'),
  ('abababab-abab-4bab-8bab-ababababab02', '88888888-8888-4888-8888-888888888887', 'Submission that becomes rejected.', 'published');

update public.line_submissions s
set promoted_prompt_id = p.id
from public.prompts p
where (s.id = 'abababab-abab-4bab-8bab-ababababab01' and p.slug = 'reply-all-event')
   or (s.id = 'abababab-abab-4bab-8bab-ababababab02' and p.slug = 'cape-dry-clean');

set local "request.jwt.claim.role" = 'service_role';
do $$
begin
  perform * from public.set_delivery_visibility(
    '99999999-9999-4999-8999-999999999901', 'public',
    '88888888-8888-4888-8888-888888888884'
  );
  perform * from public.set_delivery_visibility(
    '99999999-9999-4999-8999-999999999902', 'public',
    '88888888-8888-4888-8888-888888888884'
  );
  perform * from public.set_delivery_visibility(
    '99999999-9999-4999-8999-999999999903', 'public',
    '88888888-8888-4888-8888-888888888884'
  );
  perform * from public.set_delivery_visibility(
    '99999999-9999-4999-8999-999999999904', 'public',
    '88888888-8888-4888-8888-888888888884'
  );
  perform * from public.set_delivery_visibility(
    '99999999-9999-4999-8999-999999999905', 'public',
    '88888888-8888-4888-8888-888888888884'
  );
  perform * from public.set_delivery_visibility(
    '99999999-9999-4999-8999-999999999906', 'public',
    '88888888-8888-4888-8888-888888888884'
  );
end;
$$;

-- Ten open reports cover each launch decision/target path plus authorization and
-- unsupported-decision rollback behavior.
insert into public.reports (id, reporter_id, delivery_id, reason, details)
values
  ('98989898-9898-4989-8989-989898989801', '88888888-8888-4888-8888-888888888883', '99999999-9999-4999-8999-999999999901', 'privacy', 'Delivery limit.'),
  ('98989898-9898-4989-8989-989898989802', '88888888-8888-4888-8888-888888888883', '99999999-9999-4999-8999-999999999902', 'privacy', 'Delivery remove.');

insert into public.reports (id, reporter_id, profile_id, reason, details)
values
  ('98989898-9898-4989-8989-989898989803', '88888888-8888-4888-8888-888888888883', '88888888-8888-4888-8888-888888888885', 'privacy', 'Profile limit.'),
  ('98989898-9898-4989-8989-989898989804', '88888888-8888-4888-8888-888888888883', '88888888-8888-4888-8888-888888888886', 'privacy', 'Profile remove.');

insert into public.reports (id, reporter_id, prompt_id, reason, details)
select r.id, '88888888-8888-4888-8888-888888888883', p.id, 'privacy', r.details
from (
  values
    ('98989898-9898-4989-8989-989898989805'::uuid, 'calendar-hostile'::text, 'Prompt limit.'::text),
    ('98989898-9898-4989-8989-989898989806'::uuid, 'doom-calendar'::text, 'Prompt remove.'::text),
    ('98989898-9898-4989-8989-989898989809'::uuid, 'timeline-needs-me'::text, 'Prompt allow.'::text),
    ('98989898-9898-4989-8989-989898989810'::uuid, 'timeline-needs-me'::text, 'Unsupported suspend.'::text)
) as r(id, slug, details)
join public.prompts p on p.slug = r.slug;

insert into public.reports (id, reporter_id, submission_id, reason, details)
values
  ('98989898-9898-4989-8989-989898989807', '88888888-8888-4888-8888-888888888883', 'abababab-abab-4bab-8bab-ababababab01', 'privacy', 'Submission limit.'),
  ('98989898-9898-4989-8989-989898989808', '88888888-8888-4888-8888-888888888883', 'abababab-abab-4bab-8bab-ababababab02', 'privacy', 'Submission remove.');

set local "request.jwt.claim.role" = 'authenticated';
select throws_ok(
  $$ select public.resolve_moderation_report(
    '98989898-9898-4989-8989-989898989801',
    '88888888-8888-4888-8888-888888888881',
    'limit', 'Policy violation', null
  ) $$,
  '42501',
  'Only the trusted service may resolve moderation reports',
  'browser callers cannot resolve reports directly'
);

set local "request.jwt.claim.role" = 'service_role';
select throws_ok(
  $$ select public.resolve_moderation_report(
    '98989898-9898-4989-8989-989898989801',
    '88888888-8888-4888-8888-888888888882',
    'limit', 'Policy violation', null
  ) $$,
  '42501',
  'Moderation actor must be a moderator or admin',
  'the service cannot attribute a decision to a non-staff actor'
);
select is(
  (
    select row(r.state, (select count(*) from public.moderation_actions a where a.report_id = r.id))::text
    from public.reports r where r.id = '98989898-9898-4989-8989-989898989801'
  ),
  row('open'::public.report_state, 0::bigint)::text,
  'failed authorization mutates neither report nor audit state'
);

create temporary table moderation_results (
  result_kind text primary key,
  payload jsonb not null
) on commit drop;

insert into moderation_results values
  ('delivery-limit', public.resolve_moderation_report('98989898-9898-4989-8989-989898989801', '88888888-8888-4888-8888-888888888881', 'limit', 'Delivery policy limit', null)),
  ('delivery-remove', public.resolve_moderation_report('98989898-9898-4989-8989-989898989802', '88888888-8888-4888-8888-888888888881', 'remove', 'Delivery policy removal', null));

select is(
  (select row(payload ->> 'state', payload ->> 'targetType', payload ->> 'targetState', payload ->> 'revokedShareAssetPath')::text from moderation_results where result_kind = 'delivery-limit'),
  row('actioned', 'delivery', 'judged', 'moderation/limit-card.png')::text,
  'delivery limit returns an actioned containment receipt'
);
select ok(
  (select d.state = 'judged' and d.visibility = 'private' and d.published_at is null and d.share_asset_path is null
     and d.moderation_labels @> array['publish-limited', 'moderator-limited']
     and not ('publish-approved' = any(d.moderation_labels))
   from public.deliveries d where d.id = '99999999-9999-4999-8999-999999999901'),
  'delivery limit quarantines publication while retaining the judged result'
);
select is(
  (select row(payload ->> 'state', payload ->> 'targetType', payload ->> 'targetState', payload ->> 'revokedShareAssetPath')::text from moderation_results where result_kind = 'delivery-remove'),
  row('actioned', 'delivery', 'removed', 'moderation/remove-card.png')::text,
  'delivery remove returns an actioned removal receipt'
);
select ok(
  (select d.state = 'removed' and d.visibility = 'private' and d.published_at is null and d.share_asset_path is null
     and d.recording_path is not null and d.failure_code = 'moderation-removed'
     and d.moderation_labels @> array['publish-rejected', 'moderator-removed']
     and exists (select 1 from public.delivery_scores s where s.delivery_id = d.id)
   from public.deliveries d where d.id = '99999999-9999-4999-8999-999999999902'),
  'delivery remove hides public content but retains evidence for review'
);
select is(
  (select row(judged_deliveries, public_deliveries)::text from public.user_stats where user_id = '88888888-8888-4888-8888-888888888884'),
  row(5, 4)::text,
  'delivery containment refreshes the owner rollups atomically'
);

insert into moderation_results values
  ('profile-limit', public.resolve_moderation_report('98989898-9898-4989-8989-989898989803', '88888888-8888-4888-8888-888888888881', 'limit', 'Profile visibility limit', null)),
  ('profile-remove', public.resolve_moderation_report('98989898-9898-4989-8989-989898989804', '88888888-8888-4888-8888-888888888881', 'remove', 'Profile surface removal', null));

select is(
  (select row(payload ->> 'state', payload ->> 'targetType', payload ->> 'targetState')::text from moderation_results where result_kind = 'profile-limit'),
  row('actioned', 'profile', 'private')::text,
  'profile limit returns a private-profile containment receipt'
);
select ok(
  (select p.is_private and p.display_name = 'Limited Display' and p.bio is not null
     and p.avatar_path is not null
     and exists (
       select 1 from public.account_restrictions r
       where r.user_id = p.id and r.kind = 'profile-limit' and r.ends_at is null
     )
     and not exists (
       select 1 from public.follows f
       where f.follower_id = p.id or f.following_id = p.id
     )
   from public.profiles p where p.id = '88888888-8888-4888-8888-888888888885'),
  'profile limit is durable, private, and severs every prior follow edge'
);
select is(
  (select row(payload ->> 'state', payload ->> 'targetType', payload ->> 'targetState', payload ->> 'revokedAvatarPath')::text from moderation_results where result_kind = 'profile-remove'),
  row('actioned', 'profile', 'private', '88888888-8888-4888-8888-888888888886/moderation-avatar.png')::text,
  'profile remove returns its revoked avatar reference for storage cleanup'
);
select ok(
  (select p.is_private and p.display_name = 'Player' and p.bio is null
     and p.avatar_path is null and p.handle::text = 'profile_remove'
     and exists (
       select 1 from public.account_restrictions r
       where r.user_id = p.id and r.kind = 'profile-remove' and r.ends_at is null
     )
     and not exists (
       select 1 from public.follows f
       where f.follower_id = p.id or f.following_id = p.id
     )
   from public.profiles p where p.id = '88888888-8888-4888-8888-888888888886'),
  'profile remove clears public identity surfaces, preserves handle/account, and severs follows'
);

set local "request.jwt.claim.sub" = '88888888-8888-4888-8888-888888888883';
select throws_ok(
  $$ insert into public.follows (follower_id, following_id)
     values (
       '88888888-8888-4888-8888-888888888883',
       '88888888-8888-4888-8888-888888888885'
     ) $$,
  '55000',
  'Profile is unavailable to follow',
  'a stale follow cannot reopen a moderator-limited profile after cleanup'
);
select ok(
  not public.can_view_profile('88888888-8888-4888-8888-888888888885'),
  'profile RLS remains closed even if a follow edge is recreated by maintenance'
);

update public.profiles
set is_private = false
where id = '88888888-8888-4888-8888-888888888885';
select is(
  (select is_private from public.profiles where id = '88888888-8888-4888-8888-888888888885'),
  true,
  'a later trusted account edit cannot undo an active profile limit'
);

update public.profiles
set is_private = false,
    display_name = 'Restored without staff',
    bio = 'Attempted restoration.',
    avatar_path = 'restored/avatar.png'
where id = '88888888-8888-4888-8888-888888888886';
select ok(
  (select is_private and display_name = 'Player' and bio is null and avatar_path is null
   from public.profiles where id = '88888888-8888-4888-8888-888888888886'),
  'a later trusted account edit cannot undo an active profile removal'
);

insert into moderation_results values
  ('prompt-limit', public.resolve_moderation_report('98989898-9898-4989-8989-989898989805', '88888888-8888-4888-8888-888888888881', 'limit', 'Prompt requires review', null)),
  ('prompt-remove', public.resolve_moderation_report('98989898-9898-4989-8989-989898989806', '88888888-8888-4888-8888-888888888881', 'remove', 'Prompt retired by policy', null));

select is(
  (select row(payload ->> 'targetType', payload ->> 'targetState', (payload -> 'revokedShareAssetPaths') @> '["moderation/prompt-limit-card.png"]'::jsonb)::text from moderation_results where result_kind = 'prompt-limit'),
  row('prompt', 'review', true)::text,
  'prompt limit returns review state and every revoked derivative path'
);
select is(
  (select state from public.prompts where slug = 'calendar-hostile'),
  'review'::public.content_state,
  'prompt limit persists the review state'
);
select ok(
  (select d.state = 'judged' and d.visibility = 'private'
     and d.published_at is null and d.share_asset_path is null
     and d.moderation_labels @> array['publish-limited', 'moderator-limited']
   from public.deliveries d where d.id = '99999999-9999-4999-8999-999999999903'),
  'prompt limit atomically quarantines every derived delivery'
);
select is(
  (select row(payload ->> 'targetType', payload ->> 'targetState', (payload -> 'revokedShareAssetPaths') @> '["moderation/prompt-remove-card.png"]'::jsonb)::text from moderation_results where result_kind = 'prompt-remove'),
  row('prompt', 'archived', true)::text,
  'prompt remove returns archive state and every revoked derivative path'
);
select is(
  (select state from public.prompts where slug = 'doom-calendar'),
  'archived'::public.content_state,
  'prompt remove persists the archived state'
);
select ok(
  (select d.state = 'removed' and d.visibility = 'private'
     and d.published_at is null and d.share_asset_path is null
     and d.recording_path is not null
     and d.moderation_labels @> array['publish-rejected', 'moderator-removed']
   from public.deliveries d where d.id = '99999999-9999-4999-8999-999999999904'),
  'prompt remove hides derived performances while retaining moderation evidence'
);

select throws_ok(
  $$ update public.deliveries
     set visibility = 'public'
     where id = '99999999-9999-4999-8999-999999999903' $$,
  '42501',
  'Deliveries for an unpublished prompt cannot be public',
  'even a trusted raw write cannot republish a contained prompt'
);

insert into moderation_results values
  ('submission-limit', public.resolve_moderation_report('98989898-9898-4989-8989-989898989807', '88888888-8888-4888-8888-888888888881', 'limit', 'Submission requires review', null)),
  ('submission-remove', public.resolve_moderation_report('98989898-9898-4989-8989-989898989808', '88888888-8888-4888-8888-888888888881', 'remove', 'Submission rejected by policy', null));

select is(
  (select row(payload ->> 'targetType', payload ->> 'targetState', payload ->> 'propagatedPromptState')::text from moderation_results where result_kind = 'submission-limit'),
  row('submission', 'review', 'review')::text,
  'submission limit returns review state for it and its promoted prompt'
);
select ok(
  (select s.state = 'review'
     and s.reviewed_by = '88888888-8888-4888-8888-888888888881'
     and s.reviewed_at is not null
     and p.state = 'review'
   from public.line_submissions s
   join public.prompts p on p.id = s.promoted_prompt_id
   where s.id = 'abababab-abab-4bab-8bab-ababababab01'),
  'submission limit persists review ownership and contains its promoted prompt'
);
select ok(
  (select d.state = 'judged' and d.visibility = 'private' and d.share_asset_path is null
     and d.moderation_labels @> array['publish-limited', 'moderator-limited']
   from public.deliveries d where d.id = '99999999-9999-4999-8999-999999999905'),
  'submission limit propagates quarantine to promoted-prompt deliveries'
);
select is(
  (select row(payload ->> 'targetType', payload ->> 'targetState', payload ->> 'propagatedPromptState')::text from moderation_results where result_kind = 'submission-remove'),
  row('submission', 'rejected', 'archived')::text,
  'submission remove returns rejected state and archives its promoted prompt'
);
select ok(
  (select s.state = 'rejected'
     and s.reviewed_by = '88888888-8888-4888-8888-888888888881'
     and s.reviewed_at is not null
     and p.state = 'archived'
   from public.line_submissions s
   join public.prompts p on p.id = s.promoted_prompt_id
   where s.id = 'abababab-abab-4bab-8bab-ababababab02'),
  'submission remove persists rejection ownership and removes its promoted prompt'
);
select ok(
  (select d.state = 'removed' and d.visibility = 'private' and d.share_asset_path is null
     and d.recording_path is not null
     and d.moderation_labels @> array['publish-rejected', 'moderator-removed']
   from public.deliveries d where d.id = '99999999-9999-4999-8999-999999999906'),
  'submission remove propagates removal to promoted-prompt deliveries'
);
select is(
  (select row(judged_deliveries, public_deliveries)::text from public.user_stats where user_id = '88888888-8888-4888-8888-888888888884'),
  row(3, 0)::text,
  'all prompt propagation paths refresh affected user rollups'
);

select is(
  (
    select row(
      (select count(*) from public.moderation_actions a where a.report_id between '98989898-9898-4989-8989-989898989801' and '98989898-9898-4989-8989-989898989808'),
      (select count(*) from public.reports r where r.id between '98989898-9898-4989-8989-989898989801' and '98989898-9898-4989-8989-989898989808' and r.state = 'actioned')
    )::text
  ),
  row(8::bigint, 8::bigint)::text,
  'every successful containment has exactly one audit row and actioned report'
);

insert into moderation_results values (
  'allow', public.resolve_moderation_report('98989898-9898-4989-8989-989898989809', '88888888-8888-4888-8888-888888888881', 'allow', 'No violation found', null)
);
select is(
  (select row(payload ->> 'state', payload ->> 'decision', payload ->> 'targetState')::text from moderation_results where result_kind = 'allow'),
  row('dismissed', 'allow', 'published')::text,
  'allow dismisses the report without changing the target state'
);
select ok(
  (select p.state = 'published' and r.state = 'dismissed' and a.decision = 'allow'
   from public.prompts p
   join public.reports r on r.prompt_id = p.id
   join public.moderation_actions a on a.report_id = r.id
   where r.id = '98989898-9898-4989-8989-989898989809'),
  'allow preserves content and records the dismissal audit action'
);

select throws_ok(
  $$ select public.resolve_moderation_report(
    '98989898-9898-4989-8989-989898989810',
    '88888888-8888-4888-8888-888888888881',
    'suspend', 'Unsupported launch decision', null
  ) $$,
  '22023',
  'Moderation decision must be allow, limit, or remove',
  'unsupported account decisions fail closed'
);
select is(
  (select row(r.state, (select count(*) from public.moderation_actions a where a.report_id = r.id))::text
   from public.reports r where r.id = '98989898-9898-4989-8989-989898989810'),
  row('open'::public.report_state, 0::bigint)::text,
  'unsupported decisions leave report and audit state untouched'
);

select throws_ok(
  $$ select public.resolve_moderation_report(
    '98989898-9898-4989-8989-989898989801',
    '88888888-8888-4888-8888-888888888881',
    'allow', 'Duplicate resolution', null
  ) $$,
  '55000',
  'Moderation report is already resolved',
  'a resolved report cannot create a second decision'
);

select * from finish();
rollback;
