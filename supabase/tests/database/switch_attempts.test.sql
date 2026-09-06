begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select ok(not has_table_privilege('anon','public.switch_attempts','SELECT'), 'guest credentials cannot enumerate Switch audio');
select ok(not has_table_privilege('authenticated','public.switch_attempts','UPDATE'), 'account cannot mutate immutable snapshots through PostgREST');
select ok(not has_table_privilege('authenticated','public.switch_challenges','SELECT'), 'direct invitation capabilities are not public rows');
select ok((select relrowsecurity from pg_class where oid='public.switch_attempts'::regclass), 'Switch attempts have default deny RLS');
select ok((select relrowsecurity from pg_class where oid='public.switch_challenges'::regclass), 'Switch invitations have default deny RLS');
select ok(has_table_privilege('service_role','public.switch_attempts','INSERT'), 'authorized server can save Switch audio');
select ok(not has_function_privilege('authenticated','public.guard_switch_challenge()','EXECUTE'), 'invitation trigger is not a client endpoint');

insert into auth.users(id,email,raw_user_meta_data) values
 ('91919191-0000-4000-8000-000000000001','switch-owner@example.test','{"user_name":"switch_owner"}'),
 ('91919191-0000-4000-8000-000000000002','switch-stranger@example.test','{"user_name":"switch_stranger"}');
create temporary table switch_fixture as select jsonb_build_object(
 'id','repeat-fixture','version','1','kind','emotion','title','Same phrase','description','Private SQL fixture','difficulty','easy','tags','[]'::jsonb,
 'duration',20,'rating','everyone','scoringVersion','switch-audio-v1-beta','rubricVersion','switch-audio-v1.0',
 'cues',(select jsonb_agg(jsonb_build_object('id',n::text,'text','That is my sandwich.','direction','Clearly amused','directionLabel','Amused','emoji','🙂','start',(n-1)*4,'end',n*4)) from generate_series(1,5) n)
) as snapshot;
insert into public.switch_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,challenge_version_id,challenge_snapshot,scoring_version,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
select '92929292-0000-4000-8000-000000000001',repeat('a',64),'guest:'||repeat('a',64),'guest-take','hash','repeat-fixture:1',snapshot,
 'switch-audio-v1-beta','guests/'||repeat('a',64)||'/switch/92929292-0000-4000-8000-000000000001.wav','audio/wav','audio-hash',20000,now()+interval '1 day' from switch_fixture;
select throws_ok($q$update public.switch_attempts set challenge_snapshot=jsonb_set(challenge_snapshot,'{cues,0,directionLabel}','"Angry"')$q$,'55000','SWITCH_ATTEMPT_IMMUTABLE','cue changes cannot rewrite a saved take');
select throws_ok($q$update public.switch_attempts set recording_offset_ms=100$q$,'55000','SWITCH_ATTEMPT_IMMUTABLE','later scoring cannot slide recording timing to fit speech');
select throws_ok($q$update public.switch_attempts set audio_hash='replacement'$q$,'55000','SWITCH_ATTEMPT_IMMUTABLE','partial replacement cannot alter captured audio');
select lives_ok($q$update public.switch_attempts set expires_at=now()+interval '14 days'$q$,'existing round retention can extend submitted guest replay');
select lives_ok($q$update public.switch_attempts set user_id='91919191-0000-4000-8000-000000000001',guest_owner_hash=null,owner_key='user:91919191-0000-4000-8000-000000000001',expires_at=null,recording_path='91919191-0000-4000-8000-000000000001/switch/92929292-0000-4000-8000-000000000001.wav'$q$,'authorized guest claim preserves immutable take and updates its storage owner');
select is((select challenge_snapshot from public.switch_attempts),(select snapshot from switch_fixture),'claim retains exact challenge and all cue timings');
select lives_ok($q$update public.switch_attempts set status='scored', score='{"version":"switch-audio-v1-beta","rubricVersion":"switch-audio-v1.0","beta":true,"ranked":false,"overall":75}',moderation_state='approved'$q$,'versioned beta score can be attached once');
select throws_ok($q$update public.switch_attempts set score=jsonb_set(score,'{overall}','99')$q$,'55000','SWITCH_SCORE_IMMUTABLE','stale results cannot replace a committed score');
select throws_ok($q$update public.switch_attempts set status='failed'$q$,'55000','SWITCH_SCORE_IMMUTABLE','late provider failure cannot erase a successful result');

select throws_ok($q$insert into public.switch_challenges(created_by,attempt_id,token_hash,challenge_version_id,challenge_snapshot,scoring_version)
select '91919191-0000-4000-8000-000000000002','92929292-0000-4000-8000-000000000001','wrong-owner','repeat-fixture:1',snapshot,'switch-audio-v1-beta' from switch_fixture$q$,
 '55000','SWITCH_CHALLENGE_SOURCE_INVALID','another account cannot create an invitation from private audio');
select lives_ok($q$insert into public.switch_challenges(id,created_by,attempt_id,token_hash,challenge_version_id,challenge_snapshot,scoring_version)
select '93939393-0000-4000-8000-000000000001','91919191-0000-4000-8000-000000000001','92929292-0000-4000-8000-000000000001','capability-digest','repeat-fixture:1',snapshot,'switch-audio-v1-beta' from switch_fixture$q$,'owner can opt an approved take into an exact friend invitation');
select throws_ok($q$update public.switch_challenges set challenge_snapshot=jsonb_set(challenge_snapshot,'{duration}','18')$q$,'55000','SWITCH_CHALLENGE_IMMUTABLE','invitation duration cannot drift after sharing');
select lives_ok($q$update public.switch_challenges set revoked_at=now()$q$,'invitation revocation remains possible');
select lives_ok($q$delete from public.switch_attempts where id='92929292-0000-4000-8000-000000000001'$q$,'owner deletion removes take');
select is((select count(*)::integer from public.switch_challenges),0,'deleting shared original revokes its invitation by cascade');
select * from finish();
rollback;
