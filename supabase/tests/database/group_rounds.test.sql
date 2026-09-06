begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select ok(not has_table_privilege('anon','public.challenge_group_members','SELECT'), 'guest credentials cannot read membership through PostgREST');
select ok(not has_table_privilege('authenticated','public.challenge_group_takes','SELECT'), 'accounts cannot bypass reveal for group audio');
select ok(not has_table_privilege('authenticated','public.challenge_group_votes','INSERT'), 'votes require the authorized API');
select ok(not has_function_privilege('authenticated','public.group_round_action(uuid,uuid,text,text,jsonb)','EXECUTE'), 'clients cannot impersonate RPC owners');
select ok(has_function_privilege('service_role','public.group_round_action(uuid,uuid,text,text,jsonb)','EXECUTE'), 'application may perform checked group mutations');
select ok(has_function_privilege('service_role','public.lock_users_for_account_mutation(uuid[])','EXECUTE'), 'invoker group RPCs can execute the account containment helper');
select ok(not has_function_privilege('anon','public.lock_users_for_account_mutation(uuid[])','EXECUTE'), 'anonymous clients cannot execute the account containment helper');
select ok(not has_function_privilege('authenticated','public.lock_users_for_account_mutation(uuid[])','EXECUTE'), 'signed-in clients cannot execute the account containment helper');
select ok(not (select prosecdef from pg_proc where oid = 'public.group_round_action(uuid,uuid,text,text,jsonb)'::regprocedure), 'group mutations are security invoker');

insert into auth.users(id,email,raw_user_meta_data) values
 ('66666666-0000-4000-8000-000000000001','group-account@example.test','{"user_name":"group_account"}'),
 ('66666666-0000-4000-8000-000000000002','group-other@example.test','{"user_name":"group_other"}');

create temporary table group_fixture as select
 '77777777-0000-4000-8000-000000000001'::uuid as request_id,
 null::uuid as round_id,
 '77777777-0000-4000-8000-000000000002'::uuid as other_request_id,
 null::uuid as other_round_id,
 repeat('a',64) as host_hash, repeat('b',64) as friend_hash,
 jsonb_build_object('mode','classic','promptId',p.id,'promptSlug',p.slug,
   'scoringVersion','classic-group-test','rubricVersion','classic-rubric-test','rating','everyone') as assignment
 from public.prompts p where p.slug = 'timeline-needs-me';

select lives_ok($q$select public.create_group_round(null,host_hash,repeat('c',64),'Friends',assignment,
 now()+interval '1 day',null,request_id,'Host') from group_fixture$q$, 'guest creates a round and stable host in one transaction');
update group_fixture set round_id=(select id from public.challenges where group_token_hash=repeat('c',64));
select lives_ok($q$select public.create_group_round(null,host_hash,repeat('c',64),'Friends',assignment,
 now()+interval '1 day 1 second',null,request_id,'Host') from group_fixture$q$, 'same create request is idempotent despite close-clock drift');
select is((select count(*)::integer from public.challenge_group_members where challenge_id = (select round_id from group_fixture)),1,'creation retry does not duplicate host');
select throws_ok($q$select public.create_group_round(null,friend_hash,repeat('c',64),'Friends',assignment,
 now()+interval '1 day',null,request_id,'Imposter') from group_fixture$q$,'23505','ROUND_IDEMPOTENCY_CONFLICT','another owner cannot reuse creation request');
select ok((select created_by is null and token_digest is null from public.challenges where id = (select round_id from group_fixture)), 'group parent has no legacy invitation credential or account cascade');
select isnt((select round_id from group_fixture),(select request_id from group_fixture),'public round ID never reveals private creation request identity');

select lives_ok($q$select public.group_round_action(round_id,null,friend_hash,'join','{"displayName":"Friend"}') from group_fixture$q$,'guest friend joins');
select lives_ok($q$select public.group_round_action(round_id,null,friend_hash,'join','{"displayName":"Ignored retry"}') from group_fixture$q$,'duplicate join returns stable membership');
select is((select count(*)::integer from public.challenge_group_members where challenge_id = (select round_id from group_fixture)),2,'join retry keeps two participants');

create temporary table group_members as select id,guest_owner_hash from public.challenge_group_members
 where challenge_id = (select round_id from group_fixture);
insert into public.challenge_group_takes(id,challenge_id,member_id,attempt_key,request_fingerprint,mode,
 recording_path,audio_mime,audio_hash,duration_ms,scoring_version,moderation_state,expires_at)
select ('88888888-0000-4000-8000-00000000000' || row_number() over(order by m.guest_owner_hash))::uuid,
 f.round_id,m.id,gen_random_uuid(),'sql-workflow-fixture','classic',
 'group-fixtures/' || m.id::text || '/take.webm','audio/webm','test-hash',1200,
 'classic-group-test','unreviewed',now()+interval '14 days'
from group_fixture f cross join group_members m;

select lives_ok($q$select public.group_round_action(f.round_id,null,f.host_hash,'submit',
 jsonb_build_object('takeId',t.id)) from group_fixture f join public.challenge_group_takes t
 on t.id = '88888888-0000-4000-8000-000000000001'$q$, 'explicitly unreviewed private performance can submit without invented score');
select lives_ok($q$select public.group_round_action(f.round_id,null,f.host_hash,'submit',
 jsonb_build_object('takeId',t.id)) from group_fixture f join public.challenge_group_takes t
 on t.id = '88888888-0000-4000-8000-000000000001'$q$, 'duplicate submission is idempotent');
select throws_ok($q$select public.group_round_action(round_id,null,friend_hash,'submit',
 '{"takeId":"88888888-0000-4000-8000-000000000001"}') from group_fixture$q$,
 '22023','ROUND_TAKE_INVALID','friend cannot submit host audio');
select throws_ok($q$select public.group_round_action(round_id,null,friend_hash,'close','{}') from group_fixture$q$,
 '42501','ROUND_FORBIDDEN','member cannot close the round');
select throws_ok($q$select public.group_round_action(round_id,null,friend_hash,'vote',
 jsonb_build_object('targetMemberId',(select id from group_members where guest_owner_hash = host_hash))) from group_fixture$q$,
 '55000','ROUND_VOTE_INVALID','pre-reveal voting is rejected in storage');

insert into public.challenge_group_takes(id,challenge_id,member_id,attempt_key,request_fingerprint,mode,
 recording_path,audio_mime,audio_hash,duration_ms,scoring_version,moderation_state,expires_at)
select '88888888-0000-4000-8000-000000000003',round_id,m.id,gen_random_uuid(),'second-sql-fixture','classic',
 'group-fixtures/replacement.webm','audio/webm','test-hash-2',1300,'classic-group-test','approved',now()+interval '14 days'
from group_fixture f join group_members m on m.guest_owner_hash = f.host_hash;
select lives_ok($q$select public.group_round_action(round_id,null,host_hash,'submit',
 '{"takeId":"88888888-0000-4000-8000-000000000003"}') from group_fixture$q$,'replacement selects another private candidate');
select is((select submitted_take_id::text from public.challenge_group_members m join group_fixture f
 on m.challenge_id = f.round_id and m.guest_owner_hash = f.host_hash),'88888888-0000-4000-8000-000000000003','replacement keeps exactly one current leaderboard entry');
select is((select count(*)::integer from public.challenge_group_takes where member_id =
 (select id from group_members where guest_owner_hash = repeat('a',64))),2,'replacement retains the previous private take');
select throws_ok($q$select public.group_round_action(round_id,null,host_hash,'submit',
 '{"takeId":"88888888-0000-4000-8000-000000000001"}') from group_fixture$q$,
 '23505','ROUND_TAKE_SUPERSEDED','late retry of a replaced take cannot revert the current choice');
select is((select submitted_take_id::text from public.challenge_group_members m join group_fixture f
 on m.challenge_id=f.round_id and m.guest_owner_hash=f.host_hash),'88888888-0000-4000-8000-000000000003','out of order retries preserve the latest accepted replacement');

select lives_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000001',friend_hash,'claim','{}') from group_fixture$q$,'original guest capability claims account membership');
select lives_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000001',friend_hash,'claim','{}') from group_fixture$q$,'account claim is idempotent');
select throws_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000002',friend_hash,'claim','{}') from group_fixture$q$,
 '42501','ROUND_CLAIM_CONFLICT','another account cannot claim an already-owned guest');
select throws_ok($q$select public.group_round_action(round_id,null,friend_hash,'submit',
 '{"takeId":"88888888-0000-4000-8000-000000000002"}') from group_fixture$q$,
 '42501','ROUND_NOT_MEMBER','guest cookie loses authority after account claim');
select lives_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000001',null,'submit',
 '{"takeId":"88888888-0000-4000-8000-000000000002"}') from group_fixture$q$,'claimed account retains its private take');

select lives_ok($q$select public.group_round_action(round_id,null,host_hash,'revoke','{}') from group_fixture$q$,'host revokes invitation for new members');
select lives_ok($q$select public.group_round_action(round_id,null,host_hash,'revoke','{}') from group_fixture$q$,'revoke is idempotent');
select throws_ok($q$select public.group_round_action(round_id,null,repeat('d',64),'join','{"displayName":"Late"}') from group_fixture$q$,
 '55000','ROUND_INVITE_REVOKED','revoked invitation rejects new join');
select lives_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000001',null,'join','{"displayName":"Friend"}') from group_fixture$q$,'existing participant retains access after revoke');

select lives_ok($q$select public.group_round_action(round_id,null,host_hash,'close','{}') from group_fixture$q$,'host closes and reveals');
select lives_ok($q$select public.group_round_action(round_id,null,host_hash,'submit',
 '{"takeId":"88888888-0000-4000-8000-000000000003"}') from group_fixture$q$,
 'accepted submission retry remains idempotent after closure');
select lives_ok($q$select public.group_round_action(round_id,null,host_hash,'close','{}') from group_fixture$q$,'closing twice is idempotent');
select ok((select state = 'completed' and group_replay_until = completed_at+interval '7 days'
 from public.challenges where id = (select round_id from group_fixture)), 'early closure advertises seven days of replay');
select throws_ok($q$select public.group_round_action(round_id,null,host_hash,'submit',
 '{"takeId":"88888888-0000-4000-8000-000000000001"}') from group_fixture$q$,
 '55000','ROUND_CLOSED','submit loses after close and cannot replace revealed results');
select lives_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000001',null,'vote',
 jsonb_build_object('targetMemberId',(select id from group_members where guest_owner_hash = host_hash))) from group_fixture$q$,'participant votes after reveal');
select lives_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000001',null,'vote',
 jsonb_build_object('targetMemberId',(select id from group_members where guest_owner_hash = host_hash))) from group_fixture$q$,'vote retry is idempotent');
select is((select count(*)::integer from public.challenge_group_votes),1,'one vote per participant is stored');
select throws_ok($q$select public.group_round_action(round_id,null,host_hash,'vote',
 jsonb_build_object('targetMemberId',(select id from group_members where guest_owner_hash = host_hash))) from group_fixture$q$,
 '22023','ROUND_VOTE_INVALID','RPC rejects self-voting with a usable application error');

select lives_ok($q$select public.create_group_round(null,host_hash,repeat('e',64),'Again',assignment,
 now()+interval '1 day',round_id,other_request_id,'Host') from group_fixture$q$,'completed round creates linked rematch');
update group_fixture set other_round_id=(select id from public.challenges where group_token_hash=repeat('e',64));
select is((select group_previous_id from public.challenges where id=(select other_round_id from group_fixture)),
 (select round_id from group_fixture),'rematch preserves previous result and immutable assignment');
select throws_ok($q$update public.challenges set group_assignment = group_assignment || '{"scoringVersion":"changed"}'
 where id = (select round_id from group_fixture)$q$,'22023','ROUND_ASSIGNMENT_IMMUTABLE','historical assignment cannot change');

-- Even the account owner cannot read group metadata through legacy SELECT RLS.
grant select on group_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.challenges where id=(select round_id from group_fixture)),0,'legacy challenge RLS conceals new round metadata');
reset role;

-- Cap is checked under the same round row lock as joins, closes, and submits.
select public.group_round_action(other_round_id,null,lpad(i::text,64,'0'),'join',
 jsonb_build_object('displayName','Guest ' || i)) from group_fixture cross join generate_series(1,11) i;
select throws_ok($q$select public.group_round_action(other_round_id,null,repeat('f',64),'join','{"displayName":"Thirteenth"}') from group_fixture$q$,
 '55000','ROUND_FULL','thirteenth participant cannot race the group cap');

-- Bound durable drafts without making duplicate attempt keys consume quota.
insert into public.challenge_group_takes(challenge_id,member_id,attempt_key,request_fingerprint,mode,
 recording_path,audio_mime,audio_hash,duration_ms,scoring_version,expires_at)
select f.other_round_id,m.id,'attempt-cap-' || i,'sql-cap','classic',
 'group-fixtures/cap-' || i || '.wav','audio/wav','sql-cap-' || i,1200,'classic-group-test',now()+interval '14 days'
from group_fixture f join public.challenge_group_members m on m.challenge_id=f.other_round_id
 and m.guest_owner_hash=f.host_hash cross join generate_series(1,20) i;
select throws_ok($q$insert into public.challenge_group_takes(challenge_id,member_id,attempt_key,request_fingerprint,mode,
 recording_path,audio_mime,audio_hash,duration_ms,scoring_version,expires_at)
select f.other_round_id,m.id,'attempt-cap-21','sql-cap','classic',
 'group-fixtures/cap-21.wav','audio/wav','sql-cap',1200,'classic-group-test',now()+interval '14 days'
from group_fixture f join public.challenge_group_members m on m.challenge_id=f.other_round_id and m.guest_owner_hash=f.host_hash$q$,
 '55000','ROUND_TAKE_LIMIT','durable draft quota is enforced inside parent lock');
select throws_ok($q$insert into public.challenge_group_takes(challenge_id,member_id,attempt_key,request_fingerprint,mode,
 recording_path,audio_mime,audio_hash,duration_ms,scoring_version,expires_at)
select f.other_round_id,m.id,'attempt-cap-20','sql-cap','classic',
 'group-fixtures/cap-duplicate.wav','audio/wav','sql-cap',1200,'classic-group-test',now()+interval '14 days'
from group_fixture f join public.challenge_group_members m on m.challenge_id=f.other_round_id and m.guest_owner_hash=f.host_hash$q$,
 '23505',null,'same attempt at quota produces recoverable unique conflict');

-- Account deletion removes only that participant; an absent host may time out.
delete from auth.users where id='66666666-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.challenges where id=(select round_id from group_fixture)),1,'account deletion preserves other friends round results');
select is((select count(*)::integer from public.challenge_group_votes),0,'account deletion removes participant vote');


-- Source fixtures are SQL-only unscored audio receipts, never provider scores.
insert into public.say_clip_versions(id,clip_id,version,manifest) values
 ('sql-group-scene:v1','sql-group-scene','v1','{}');
create temporary table say_group_fixture as select
 null::uuid as round_id,repeat('7',64) as host_hash,
 jsonb_build_object('mode','say-it-back','scoringVersion','say-match-v1.2','rating','everyone',
   'clip',jsonb_build_object('id','sql-group-scene','version','v1'),'roleId','speaker') as assignment;
grant select,update on say_group_fixture to service_role;
set local role service_role;
select lives_ok($q$select public.create_group_round(null,host_hash,repeat('8',64),'Say friends',assignment,
 now()+interval '1 day',null,'77777777-0000-4000-8000-000000000003','Say host') from say_group_fixture$q$,
 'real application role can create Say group without Classic rubric');
update say_group_fixture set round_id=(select id from public.challenges where group_token_hash=repeat('8',64));
reset role;
insert into public.say_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,
 clip_version_id,clip_snapshot,role_id,scoring_version,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
select '99999999-0000-4000-8000-000000000001',host_hash,'guest:sql-group','sql-group-test','sql-group-test',
 'sql-group-scene:v1',assignment->'clip','speaker','say-match-v1.2','group-fixtures/say-source.wav',
 'audio/wav','sql-test-hash',1200,now()+interval '1 hour' from say_group_fixture;
insert into public.challenge_group_takes(id,challenge_id,member_id,attempt_key,request_fingerprint,mode,
 say_attempt_id,scoring_version,expires_at)
select '99999999-0000-4000-8000-000000000002',f.round_id,m.id,'attempt-say-test','sql-test','say-it-back',
 '99999999-0000-4000-8000-000000000001','say-match-v1.2',now()+interval '14 days'
 from say_group_fixture f join public.challenge_group_members m on m.challenge_id=f.round_id;
select lives_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000002',host_hash,'claim','{}') from say_group_fixture$q$,
 'guest Say group member can claim an account');
select lives_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000002',null,'submit',
 '{"takeId":"99999999-0000-4000-8000-000000000002"}') from say_group_fixture$q$,
 'claimed account can submit its still-guest original source');
select ok((select a.expires_at >= c.group_replay_until from public.say_attempts a
 cross join say_group_fixture f join public.challenges c on c.id=f.round_id
 where a.id='99999999-0000-4000-8000-000000000001'), 'submitted guest source survives advertised group replay window');
select throws_ok($q$select public.group_round_action(round_id,null,host_hash,'close','{}') from say_group_fixture$q$,
 '42501','ROUND_NOT_MEMBER','guest token alone cannot impersonate claimed host');
insert into public.challenge_group_takes(id,challenge_id,member_id,attempt_key,request_fingerprint,mode,
 say_attempt_id,scoring_version,expires_at)
select '99999999-0000-4000-8000-000000000004',f.round_id,m.id,'attempt-say-denied','sql-test','say-it-back',
 '99999999-0000-4000-8000-000000000001','say-match-v1.2',now()+interval '14 days'
 from say_group_fixture f join public.challenge_group_members m on m.challenge_id=f.round_id;
update public.say_attempts set moderation_state='rejected' where id='99999999-0000-4000-8000-000000000001';
select throws_ok($q$select public.group_round_action(round_id,'66666666-0000-4000-8000-000000000002',null,'submit',
 '{"takeId":"99999999-0000-4000-8000-000000000004"}') from say_group_fixture$q$,
 '22023','ROUND_TAKE_INVALID','known rejected source cannot masquerade as unreviewed private submission');
select lives_ok($q$delete from public.say_attempts where id='99999999-0000-4000-8000-000000000001'$q$,
 'source deletion safely removes its private pointer without FK conflict');
select ok((select say_attempt_id is null from public.challenge_group_takes
 where id='99999999-0000-4000-8000-000000000002'), 'deleted source cannot fall back to another recording');

-- An absent host and an empty expired round need no worker or scheduled job.
insert into public.challenges(id,code,max_entries,group_mode,group_assignment,group_name,group_token_hash,group_request_hash,
 group_closes_at,group_replay_until,created_at,expires_at)
select '77777777-0000-4000-8000-000000000004','GROUPTIMEOUT',12,'say-it-back',assignment,'Nobody home',repeat('9',64),repeat('6',64),
 now()-interval '1 day',now()+interval '12 days',now()-interval '2 days',now()+interval '12 days' from say_group_fixture;
select lives_ok($q$select public.group_round_action('77777777-0000-4000-8000-000000000004',null,null,'refresh','{}')$q$,
 'refresh closes an expired empty round without its host');
select ok((select state='completed' and completed_at=group_closes_at and group_replay_until=group_closes_at+interval '7 days'
 from public.challenges where id='77777777-0000-4000-8000-000000000004'), 'deadline closure has bounded replay measured from actual deadline');
select * from finish();
rollback;
