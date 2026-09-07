begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);

select ok((select relrowsecurity from pg_class where oid = 'public.roast_battle_results'::regclass), 'battle history has RLS enabled');
select ok(not has_table_privilege('anon', 'public.roast_battle_results', 'SELECT'), 'anonymous clients cannot read battle history directly');
select ok(not has_table_privilege('authenticated', 'public.roast_battle_results', 'INSERT,UPDATE,DELETE'), 'signed clients cannot fabricate battle history');
select ok(has_table_privilege('service_role', 'public.roast_battle_results', 'SELECT,INSERT,UPDATE,DELETE'), 'trusted worker can retain and expire history');

insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-1111-4111-8111-111111111111', 'roast-reviewer@example.test', '{"user_name":"roast_reviewer"}'),
  ('77777777-2222-4222-8222-222222222222', 'roast-reporter@example.test', '{"user_name":"roast_reporter"}');
update public.profiles set role = 'moderator' where id = '77777777-1111-4111-8111-111111111111';

set local role service_role;
insert into public.roast_battle_results (id, room_id, visibility, performer_names, result) values
  ('88888888-1111-4111-8111-111111111111', 'main', 'public', '["First","Second"]', '{"kind":"completed","votes":[2,1]}');
insert into public.roast_battle_results (id, room_id, visibility, performer_names, result) values
  ('88888888-1111-4111-8111-111111111111', 'main', 'public', '["First","Second"]', '{"kind":"completed","votes":[9,1]}')
  on conflict (id) do nothing;
select is((select count(*)::int from public.roast_battle_results), 1, 'retrying a battle result cannot create another history row');
select is((select result -> 'votes' from public.roast_battle_results), '[2,1]'::jsonb, 'duplicate insertion preserves the original result');
select ok((select expires_at = ended_at + interval '30 days' from public.roast_battle_results), 'history defaults to a thirty-day retention window');
select throws_ok($$update public.roast_battle_results set expires_at = ended_at + interval '31 days'$$,
  '23514', 'new row for relation "roast_battle_results" violates check constraint "roast_results_expiry"', 'history cannot request unbounded retention');

select lives_ok($$insert into public.reports (id, reporter_id, roast_room_id, roast_member_id, reason, details) values
  ('99999999-1111-4111-8111-111111111111', '77777777-2222-4222-8222-222222222222', 'main', 'aaaaaaaa-1111-4111-8111-111111111111', 'privacy', 'Room incident fixture.')$$,
  'signed participant can report an ephemeral room member through the trusted service');
select lives_ok($$insert into public.reports (anonymous_reporter_hash, anonymous_network_hash, roast_room_id, reason) values
  (repeat('a', 64), repeat('b', 64), 'bbbbbbbb-1111-4111-8111-111111111111', 'violence')$$,
  'guest safety report can target a private room without a profile target');
select throws_ok($$insert into public.reports (reporter_id, roast_room_id, reason) values
  ('77777777-2222-4222-8222-222222222222', '../../room', 'privacy')$$,
  '23514', 'new row for relation "reports" violates check constraint "reports_roast_room_format"', 'room target syntax is bounded');
select throws_ok($$insert into public.reports (reporter_id, profile_id, roast_member_id, reason) values
  ('77777777-2222-4222-8222-222222222222', '77777777-1111-4111-8111-111111111111', 'aaaaaaaa-1111-4111-8111-111111111111', 'privacy')$$,
  '23514', 'new row for relation "reports" violates check constraint "reports_roast_member_room"', 'an ephemeral member target requires its room');
select throws_ok($$insert into public.reports (reporter_id, profile_id, roast_room_id, reason) values
  ('77777777-2222-4222-8222-222222222222', '77777777-1111-4111-8111-111111111111', 'main', 'privacy')$$,
  '23514', 'new row for relation "reports" violates check constraint "reports_one_target"', 'room reports cannot also target an unrelated profile');

select ok(not has_function_privilege('anon', 'public.resolve_roast_report(uuid,uuid,public.moderation_decision,text,text)', 'EXECUTE'), 'guests cannot invoke staff review');
select ok(not has_function_privilege('authenticated', 'public.resolve_roast_report(uuid,uuid,public.moderation_decision,text,text)', 'EXECUTE'), 'signed users cannot bypass the staff API');
select throws_ok($$select public.resolve_roast_report('99999999-1111-4111-8111-111111111111', '77777777-2222-4222-8222-222222222222', 'limit', 'Reviewed.', null)$$,
  '42501', 'Moderation actor must be a moderator or admin', 'review RPC rechecks the current staff role');
select throws_ok($$select public.resolve_roast_report('99999999-1111-4111-8111-111111111111', '77777777-1111-4111-8111-111111111111', 'remove', 'Reviewed.', null)$$,
  '22023', 'Live room reports support manual triage or dismissal; enforcement is in the live room', 'manual review cannot claim live media enforcement');
select lives_ok($$select public.resolve_roast_report('99999999-1111-4111-8111-111111111111', '77777777-1111-4111-8111-111111111111', 'limit', 'Reviewed; room host handles enforcement.', 'Manual triage fixture.')$$,
  'staff can record a live room review');
select is((select state::text from public.reports where id = '99999999-1111-4111-8111-111111111111'), 'triaged', 'review is accurately marked triaged');
select is((select count(*)::int from public.moderation_actions where report_id = '99999999-1111-4111-8111-111111111111' and roast_room_id = 'main'), 1, 'manual review writes one room-scoped audit record');
select throws_ok($$select public.resolve_roast_report('99999999-1111-4111-8111-111111111111', '77777777-1111-4111-8111-111111111111', 'limit', 'Repeated review.', null)$$,
  '55000', 'This live room report was already reviewed', 'duplicate review is rejected without a second audit record');
select lives_ok($$select public.resolve_roast_report('99999999-1111-4111-8111-111111111111', '77777777-1111-4111-8111-111111111111', 'allow', 'No additional action required.', null)$$,
  'staff can dismiss an already triaged incident');
select is((select state::text from public.reports where id = '99999999-1111-4111-8111-111111111111'), 'dismissed', 'dismissal closes the room report');
select throws_ok($$select public.resolve_roast_report('99999999-1111-4111-8111-111111111111', '77777777-1111-4111-8111-111111111111', 'allow', 'Duplicate dismissal.', null)$$,
  '55000', 'This live room report was already reviewed', 'another host tab cannot resolve a report twice');
select lives_ok($$insert into public.reports (reporter_id, profile_id, reason) values
  ('77777777-2222-4222-8222-222222222222', '77777777-1111-4111-8111-111111111111', 'spam')$$,
  'existing profile report target remains supported');

reset role;
select * from finish();
rollback;
