begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

select has_function('public', 'get_challenge_match_entries', array['uuid']);
select ok(
  (select p.prosecdef from pg_proc p
   where p.oid = 'public.get_challenge_match_entries(uuid)'::regprocedure),
  'the narrow matchup projection is security definer'
);
select ok(
  has_function_privilege('authenticated', 'public.get_challenge_match_entries(uuid)', 'EXECUTE'),
  'authenticated participants may invoke the matchup projection'
);
select ok(
  not has_function_privilege('anon', 'public.get_challenge_match_entries(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.get_challenge_match_entries(uuid)', 'EXECUTE'),
  'anonymous and broad service callers cannot invoke the participant projection'
);
select ok(
  position('public.can_view_challenge' in lower(pg_get_functiondef(
    'public.get_challenge_match_entries(uuid)'::regprocedure
  ))) > 0
  and position('public.can_view_delivery' in lower(pg_get_functiondef(
    'public.get_challenge_match_entries(uuid)'::regprocedure
  ))) > 0,
  'the projection applies both challenge and delivery containment gates'
);
select ok(
  position('c.created_by = (select auth.uid())' in lower(pg_get_functiondef(
    'public.get_challenge_match_entries(uuid)'::regprocedure
  ))) > 0
  and position('c.recipient_user_id = (select auth.uid())' in lower(pg_get_functiondef(
    'public.get_challenge_match_entries(uuid)'::regprocedure
  ))) > 0
  and position('e.entrant_id in (c.created_by, c.recipient_user_id)' in lower(pg_get_functiondef(
    'public.get_challenge_match_entries(uuid)'::regprocedure
  ))) > 0,
  'public challenge viewers cannot use the participant-only projection'
);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('17171717-1717-4717-8717-171717171701', 'match-private-creator@example.test', '{"user_name":"match_private_creator","full_name":"Private Creator"}'::jsonb, now(), now()),
  ('17171717-1717-4717-8717-171717171702', 'match-private-rival@example.test', '{"user_name":"match_private_rival","full_name":"Private Rival"}'::jsonb, now(), now()),
  ('17171717-1717-4717-8717-171717171703', 'match-private-outsider@example.test', '{"user_name":"match_private_outsider","full_name":"Outsider"}'::jsonb, now(), now());

select is(
  (select count(*)::integer from public.profiles
   where id between '17171717-1717-4717-8717-171717171701'
     and '17171717-1717-4717-8717-171717171703'),
  3,
  'the matchup fixtures create all participant profiles'
);

update public.profiles set is_private = true
where id = '17171717-1717-4717-8717-171717171702';

select ok(
  (select is_private from public.profiles
   where id = '17171717-1717-4717-8717-171717171702'),
  'the rival is an ordinary private profile'
);

with content as (
  select p.id as prompt_id, e.id as energy_id
  from public.prompts p cross join public.energy_modifiers e
  where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss'
)
insert into public.challenges (
  id, code, created_by, recipient_user_id, prompt_id, energy_modifier_id,
  state, visibility, max_entries, expires_at
)
select
  '18181818-1818-4818-8818-181818181801', 'PRIVMT01',
  '17171717-1717-4717-8717-171717171701',
  '17171717-1717-4717-8717-171717171702',
  content.prompt_id, content.energy_id, 'open', 'link', 2,
  now() + interval '7 days'
from content;

with content as (
  select p.id as prompt_id, e.id as energy_id
  from public.prompts p cross join public.energy_modifiers e
  where p.slug = 'timeline-needs-me' and e.slug = 'defeated-final-boss'
), fixtures(delivery_id, user_id) as (
  values
    ('19191919-1919-4919-8919-191919191901'::uuid, '17171717-1717-4717-8717-171717171701'::uuid),
    ('19191919-1919-4919-8919-191919191902'::uuid, '17171717-1717-4717-8717-171717171702'::uuid)
)
insert into public.deliveries (
  id, user_id, prompt_id, energy_modifier_id, challenge_id,
  state, visibility, recording_path
)
select
  f.delivery_id, f.user_id, content.prompt_id, content.energy_id,
  '18181818-1818-4818-8818-181818181801', 'processing', 'private',
  f.user_id::text || '/' || f.delivery_id::text || '.wav'
from fixtures f cross join content;

insert into public.delivery_scores (
  delivery_id, overall, commitment, comedy, accuracy, chaos,
  headline, verdict, rubric_version, provider, model
)
values
  ('19191919-1919-4919-8919-191919191901', 88, 91, 79, 84, 86, 'Creator came prepared', 'The creator found the bit and refused to let go.', 'test-v1', 'test', 'test'),
  ('19191919-1919-4919-8919-191919191902', 92, 95, 87, 90, 89, 'Private rival took it', 'The private-account rival delivered public-game-show consequences.', 'test-v1', 'test', 'test');

insert into public.challenge_entries (challenge_id, delivery_id, entrant_id)
values
  ('18181818-1818-4818-8818-181818181801', '19191919-1919-4919-8919-191919191901', '17171717-1717-4717-8717-171717171701'),
  ('18181818-1818-4818-8818-181818181801', '19191919-1919-4919-8919-191919191902', '17171717-1717-4717-8717-171717171702');

select is(
  (select state from public.challenges
   where id = '18181818-1818-4818-8818-181818181801'),
  'completed'::public.challenge_state,
  'both judged entries complete the private-profile matchup'
);

set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '17171717-1717-4717-8717-171717171701';

select ok(
  not public.can_view_profile('17171717-1717-4717-8717-171717171702'),
  'the challenge does not create general access to the private rival profile'
);
select is(
  (select count(*)::integer from public.get_challenge_match_entries(
    '18181818-1818-4818-8818-181818181801'
  )),
  2,
  'the creator can read both authorized matchup entries'
);
select ok(
  exists (
    select 1 from public.get_challenge_match_entries(
      '18181818-1818-4818-8818-181818181801'
    ) e
    where e.entrant_id = '17171717-1717-4717-8717-171717171702'
      and e.handle = 'match_private_rival'
      and e.display_name = 'Private Rival'
      and e.delivery_id = '19191919-1919-4919-8919-191919191902'
      and e.recording_path = '17171717-1717-4717-8717-171717171702/19191919-1919-4919-8919-191919191902.wav'
      and e.overall = 92
      and e.headline = 'Private rival took it'
  ),
  'the projection exposes only the matchup identity, score, and owned audio path'
);

set local "request.jwt.claim.sub" = '17171717-1717-4717-8717-171717171702';
select is(
  (select count(*)::integer from public.get_challenge_match_entries(
    '18181818-1818-4818-8818-181818181801'
  )),
  2,
  'the private rival receives the same complete matchup projection'
);

set local "request.jwt.claim.sub" = '17171717-1717-4717-8717-171717171703';
select is(
  (select count(*)::integer from public.get_challenge_match_entries(
    '18181818-1818-4818-8818-181818181801'
  )),
  0,
  'a nonparticipant receives no matchup rows'
);

set local "request.jwt.claim.sub" = '17171717-1717-4717-8717-171717171701';
insert into public.account_restrictions (user_id, kind, reason)
values ('17171717-1717-4717-8717-171717171702', 'profile-limit', 'Contained matchup fixture');
select is(
  (select count(*)::integer from public.get_challenge_match_entries(
    '18181818-1818-4818-8818-181818181801'
  )),
  0,
  'active participant containment closes the entire matchup projection'
);

delete from public.account_restrictions
where user_id = '17171717-1717-4717-8717-171717171702'
  and kind = 'profile-limit';
select is(
  (select count(*)::integer from public.get_challenge_match_entries(
    '18181818-1818-4818-8818-181818181801'
  )),
  2,
  'lifting the fixture restriction restores the still-authorized receipt'
);

update public.prompts set state = 'archived'
where slug = 'timeline-needs-me';
select is(
  (select count(*)::integer from public.get_challenge_match_entries(
    '18181818-1818-4818-8818-181818181801'
  )),
  0,
  'an archived prompt cannot leak through a historical matchup receipt'
);

update public.prompts set state = 'published'
where slug = 'timeline-needs-me';
update public.deliveries set state = 'removed'
where id = '19191919-1919-4919-8919-191919191902';
select is(
  (select count(*)::integer from public.get_challenge_match_entries(
    '18181818-1818-4818-8818-181818181801'
  )),
  1,
  'a removed delivery is omitted while the surviving judged entry remains'
);

update public.deliveries set state = 'judged'
where id = '19191919-1919-4919-8919-191919191902';
insert into public.blocks (blocker_id, blocked_id)
values ('17171717-1717-4717-8717-171717171701', '17171717-1717-4717-8717-171717171702');
select is(
  (select count(*)::integer from public.get_challenge_match_entries(
    '18181818-1818-4818-8818-181818181801'
  )),
  0,
  'a participant block immediately revokes every matchup entry'
);

select * from finish();
rollback;
