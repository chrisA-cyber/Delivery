begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temporary table switch_round_fixture as select null::uuid id, jsonb_build_object(
  'mode','switch','rating','everyone','scoringVersion','switch-audio-v1-beta','rubricVersion','switch-audio-v1.0',
  'challenge',jsonb_build_object('id','switch-fixture','version','1','title','A tiny crisis','kind','emotion','description','Fixture only','duration',20,'difficulty','easy','rating','everyone','tags','[]'::jsonb,
    'scoringVersion','switch-audio-v1-beta','rubricVersion','switch-audio-v1.0','cues',jsonb_build_array(
      jsonb_build_object('id','first','text','The cheese is gone.','direction','Confident','directionLabel','Confident','emoji','😎','start',0,'end',4),
      jsonb_build_object('id','second','text','The cheese is gone.','direction','Panicked','directionLabel','Panicked','emoji','😱','start',4,'end',8),
      jsonb_build_object('id','third','text','The cheese is gone.','direction','Polite whisper','directionLabel','Polite whisper','emoji','🤫','start',8,'end',12),
      jsonb_build_object('id','fourth','text','The cheese is gone.','direction','Sad','directionLabel','Sad','emoji','😭','start',12,'end',16),
      jsonb_build_object('id','fifth','text','The cheese is gone.','direction','Happy','directionLabel','Happy','emoji','😁','start',16,'end',20)
    ))) assignment;
grant all on switch_round_fixture to service_role;
set local role service_role;
select lives_ok($q$select public.create_group_round(null,repeat('a',64),repeat('b',64),'Switch friends',assignment,now()+interval '1 hour',null,'77777777-2000-4000-8000-000000000001','Host',true,10,true,repeat('c',64)) from switch_round_fixture$q$,'service creates a Switch community on the existing rounds system');
update switch_round_fixture set id=(select id from public.challenges where group_token_hash=repeat('b',64));
select lives_ok($q$select public.create_group_round(null,repeat('a',64),repeat('b',64),'Switch friends',assignment,now()+interval '1 hour',null,'77777777-2000-4000-8000-000000000001','Host',true,10,true,repeat('c',64)) from switch_round_fixture$q$,'duplicate Switch creation returns the same round');
select is((select count(*)::int from public.challenges where group_token_hash=repeat('b',64)),1,'retry has one round');
select public.group_round_action(id,null,repeat('d',64),'join','{"displayName":"Player"}') from switch_round_fixture;
select public.group_round_action(id,null,repeat('e',64),'join','{"displayName":"Audience"}') from switch_round_fixture;
reset role;
create temporary table switch_round_people as select * from public.challenge_group_members where challenge_id=(select id from switch_round_fixture);
grant all on switch_round_people to service_role;
insert into public.switch_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,challenge_version_id,challenge_snapshot,scoring_version,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
select ('77777777-2000-4000-8000-'||lpad(i::text,12,'0'))::uuid,repeat('d',64),'guest:'||repeat('d',64),'switch-test-'||i,repeat('f',64),'switch-fixture:1',assignment->'challenge','switch-audio-v1-beta',
  'guests/'||repeat('d',64)||'/switch/77777777-2000-4000-8000-'||lpad(i::text,12,'0')||'.wav','audio/wav',repeat('f',64),20000,now()+interval '1 day'
from switch_round_fixture cross join generate_series(1,2) i;
insert into public.switch_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,challenge_version_id,challenge_snapshot,scoring_version,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
select '77777777-2000-4000-8000-000000000003',repeat('d',64),'guest:'||repeat('d',64),'switch-test-mismatch',repeat('f',64),'switch-fixture:1',jsonb_set(assignment->'challenge','{cues,0,end}','5'),'switch-audio-v1-beta',
  'guests/'||repeat('d',64)||'/switch/77777777-2000-4000-8000-000000000003.wav','audio/wav',repeat('f',64),20000,now()+interval '1 day'
from switch_round_fixture;
set local role service_role;
select throws_ok($q$insert into public.challenge_group_takes(challenge_id,member_id,attempt_key,request_fingerprint,mode,switch_attempt_id,scoring_version,expires_at)
select f.id,m.id,'switch-mismatched-take',repeat('f',64),'switch','77777777-2000-4000-8000-000000000003','switch-audio-v1-beta',now()+interval '13 days'
from switch_round_fixture f join switch_round_people m on m.guest_owner_hash=repeat('d',64)$q$,'22023','ROUND_TAKE_INVALID','matching IDs cannot conceal a different immutable cue timeline');
select lives_ok($q$insert into public.challenge_group_takes(challenge_id,member_id,attempt_key,request_fingerprint,mode,switch_attempt_id,scoring_version,expires_at)
select f.id,m.id,'switch-group-'||a.id,repeat('f',64),'switch',a.id,'switch-audio-v1-beta',now()+interval '13 days'
from switch_round_fixture f join switch_round_people m on m.guest_owner_hash=repeat('d',64) cross join public.switch_attempts a where a.challenge_version_id='switch-fixture:1' and a.id <> '77777777-2000-4000-8000-000000000003'$q$,'matching Switch sources enter private receipts');
select throws_ok($q$insert into public.challenge_group_takes(challenge_id,member_id,attempt_key,request_fingerprint,mode,switch_attempt_id,scoring_version,expires_at)
select f.id,m.id,'foreign-switch-take',repeat('f',64),'switch','77777777-2000-4000-8000-000000000001','switch-audio-v1-beta',now()+interval '13 days'
from switch_round_fixture f join switch_round_people m on m.guest_owner_hash=repeat('e',64)$q$,'22023','ROUND_TAKE_INVALID','foreign Switch recording cannot be submitted');
select throws_ok($q$update public.challenges set group_assignment=jsonb_set(group_assignment,'{challenge,cues,0,end}','7') where id=(select id from switch_round_fixture)$q$,'22023','ROUND_ASSIGNMENT_IMMUTABLE','cue timeline cannot change after invitation creation');
select throws_ok($q$select public.group_round_action(f.id,null,repeat('d',64),'submit',jsonb_build_object('takeId',t.id)) from switch_round_fixture f join public.challenge_group_takes t on t.challenge_id=f.id and t.switch_attempt_id='77777777-2000-4000-8000-000000000001'$q$,'P0001','ROUND_BROADCAST_CONSENT','Switch broadcast requires consent for that exact take');
select lives_ok($q$select public.group_round_action(f.id,null,repeat('d',64),'submit',jsonb_build_object('takeId',t.id,'broadcastConsent',true)) from switch_round_fixture f join public.challenge_group_takes t on t.challenge_id=f.id and t.switch_attempt_id='77777777-2000-4000-8000-000000000001'$q$,'guest submits continuous Switch take');
select ok((select expires_at >= (select group_replay_until from public.challenges where id=(select id from switch_round_fixture)) from public.switch_attempts where id='77777777-2000-4000-8000-000000000001'),'submitted guest source lasts through round replay');
select lives_ok($q$select public.group_round_action(id,null,repeat('a',64),'select',jsonb_build_object('memberId',(select id from switch_round_people where guest_owner_hash=repeat('d',64)))) from switch_round_fixture$q$,'host selects consented Switch entry');
select lives_ok($q$select public.group_round_action(f.id,null,repeat('d',64),'submit',jsonb_build_object('takeId',t.id,'broadcastConsent',true)) from switch_round_fixture f join public.challenge_group_takes t on t.challenge_id=f.id and t.switch_attempt_id='77777777-2000-4000-8000-000000000002'$q$,'replacement uses existing group submission rules');
select ok((select not showcased from public.challenge_group_members where id=(select id from switch_round_people where guest_owner_hash=repeat('d',64))),'replacement clears host selection');
select throws_ok($q$select public.group_round_action(f.id,null,repeat('d',64),'submit',jsonb_build_object('takeId',t.id,'broadcastConsent',true)) from switch_round_fixture f join public.challenge_group_takes t on t.challenge_id=f.id and t.switch_attempt_id='77777777-2000-4000-8000-000000000001'$q$,'23505','ROUND_TAKE_SUPERSEDED','late retry cannot overwrite newer submission');
select public.group_round_action(id,null,repeat('a',64),'select',jsonb_build_object('memberId',(select id from switch_round_people where guest_owner_hash=repeat('d',64)))) from switch_round_fixture;
select public.group_round_action(id,null,repeat('a',64),'close','{}') from switch_round_fixture;
select lives_ok($q$select public.group_round_action(f.id,null,repeat('d',64),'submit',jsonb_build_object('takeId',t.id,'broadcastConsent',true)) from switch_round_fixture f join public.challenge_group_takes t on t.challenge_id=f.id and t.switch_attempt_id='77777777-2000-4000-8000-000000000002'$q$,'duplicate current submission succeeds after closure');
select public.group_round_action(id,null,repeat('a',64),'showcase','{}') from switch_round_fixture;
select lives_ok($q$select public.group_round_action(id,null,repeat('a',64),'display',jsonb_build_object('memberId',(select id from switch_round_people where guest_owner_hash=repeat('d',64)),'command','play','revision',0)) from switch_round_fixture$q$,'existing broadcast controls play Switch');
select public.group_round_action(id,null,repeat('a',64),'start-voting','{}') from switch_round_fixture;
select lives_ok($q$select public.group_round_action(id,null,repeat('e',64),'vote',jsonb_build_object('targetMemberId',(select id from switch_round_people where guest_owner_hash=repeat('d',64)))) from switch_round_fixture$q$,'audience votes on Switch independently of beta score');
select throws_ok($q$select public.group_round_action(id,null,repeat('d',64),'vote',jsonb_build_object('targetMemberId',(select id from switch_round_people where guest_owner_hash=repeat('d',64)))) from switch_round_fixture$q$,'22023','ROUND_VOTE_INVALID','Switch performer cannot self vote');
select public.group_round_action(id,null,repeat('a',64),'end-voting','{}') from switch_round_fixture;
select lives_ok($q$select public.create_group_round(null,repeat('a',64),repeat('7',64),'Switch rematch',assignment,now()+interval '1 hour',id,'77777777-2000-4000-8000-000000000010','Host',true,10,true,repeat('8',64)) from switch_round_fixture$q$,'existing linked rematch supports Switch');
select is((select group_assignment from public.challenges where group_token_hash=repeat('7',64)),(select assignment from switch_round_fixture),'rematch preserves exact script, cue timeline and judging versions');
select ok(not has_table_privilege('anon','public.challenge_group_takes','SELECT'),'anonymous client cannot read Switch group receipts');
select ok(not has_function_privilege('authenticated','public.group_round_action(uuid,uuid,text,text,jsonb)','EXECUTE'),'clients cannot bypass the rounds API');
reset role;
select lives_ok($q$delete from public.switch_attempts where id='77777777-2000-4000-8000-000000000002'$q$,'deleting a Switch source preserves safe unavailable group receipt');
select ok((select switch_attempt_id is null from public.challenge_group_takes where attempt_key='switch-group-77777777-2000-4000-8000-000000000002'),'deleted source has no fallback media');
select * from finish();
rollback;
