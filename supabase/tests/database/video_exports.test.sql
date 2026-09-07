begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_table_privilege('anon','public.video_exports','SELECT'),'anonymous clients cannot enumerate private video exports');
select ok(not has_table_privilege('authenticated','public.video_exports','SELECT'),'signed clients cannot enumerate another players export');
select ok(not has_table_privilege('authenticated','public.classic_video_attempts','INSERT'),'Classic guest source writes require server ownership admission');
select ok(not has_table_privilege('anon','public.public_assignment_links','SELECT'),'public assignment reads go through content admission');
select ok((select relrowsecurity from pg_class where oid='public.video_exports'::regclass),'export table has default-deny RLS');
select ok((select relrowsecurity from pg_class where oid='public.cleanup_video_export_objects'::regclass),'cleanup paths have default-deny RLS');
select ok(not has_function_privilege('authenticated','public.claim_video_export(integer)','EXECUTE'),'clients cannot claim worker jobs');
select ok(not has_function_privilege('anon','public.request_video_export(text,uuid,text,uuid,text,jsonb,text,text,boolean,boolean)','EXECUTE'),'guest clients cannot bypass source authorization');
select is((select public from storage.buckets where id='delivery-exports'),false,'derived videos use a private bucket');
insert into public.public_assignment_links(code,fingerprint,mode,assignment) values('aabbccddeeff',repeat('a',64),'classic','{"mode":"classic","rating":"everyone"}');
select throws_ok($q$update public.public_assignment_links set assignment='{"mode":"classic","rating":"teen"}' where code='aabbccddeeff'$q$,'55000','ASSIGNMENT_LINK_IMMUTABLE','shared assignment cannot change after invitation is embedded');
select lives_ok($q$update public.public_assignment_links set disabled_at=now() where code='aabbccddeeff'$q$,'public assignment can be withdrawn');
insert into auth.users(id,email,raw_user_meta_data) values('94949494-0000-4000-8000-000000000001','video-owner@example.test','{"user_name":"video_owner"}');
insert into public.classic_video_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,audio_hash,recording_path,audio_mime,duration_ms,assignment_snapshot,expires_at)
values('95959595-0000-4000-8000-000000000001',repeat('a',64),'guest:'||repeat('a',64),'take-key-one','request-one',repeat('b',64),'guests/'||repeat('a',64)||'/classic/one.wav','audio/wav',5000,'{"mode":"classic","rating":"everyone"}',now()+interval '1 day');
create temporary table video_test_jobs(label text primary key,job jsonb);
create function pg_temp.video_request(p_source text,p_id uuid,p_owner text,p_user uuid,p_mode text,p_path text,p_hash text,p_input_hash text) returns jsonb language sql as $$
select public.request_video_export(p_source,p_id,p_owner,p_user,p_mode,jsonb_build_object('recordingPath',p_path,'audioHash',p_hash),p_input_hash,'vertical-v1',false,false);
$$;
select throws_ok($q$select pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000001','guest:'||repeat('c',64),null,'classic','guests/'||repeat('a',64)||'/classic/one.wav',repeat('b',64),repeat('d',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','another guest cannot export private source');
select throws_ok($q$select pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000001','guest:'||repeat('a',64),null,'classic','foreign/path.wav',repeat('b',64),repeat('d',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','server render snapshot cannot substitute another recording');
insert into video_test_jobs select 'first',pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000001','guest:'||repeat('a',64),null,'classic','guests/'||repeat('a',64)||'/classic/one.wav',repeat('b',64),repeat('d',64));
select is((select job->>'state' from video_test_jobs where label='first'),'queued','unscored source queues without any score requirement');
select is((select (job->>'expires_at')::timestamptz from video_test_jobs where label='first'),(select expires_at from public.classic_video_attempts where id='95959595-0000-4000-8000-000000000001'),'guest export never outlives source');
select is(pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000001','guest:'||repeat('a',64),null,'classic','guests/'||repeat('a',64)||'/classic/one.wav',repeat('b',64),repeat('d',64))->>'id',(select job->>'id' from video_test_jobs where label='first'),'identical retries reuse queued job');
select throws_ok($q$update public.video_exports set input='{}'$q$,'55000','VIDEO_EXPORT_INPUT_IMMUTABLE','worker cannot rewrite immutable render input');
update video_test_jobs set job=public.claim_video_export(600) where label='first';
select is((select job->>'state' from video_test_jobs where label='first'),'rendering','worker claims queued source');
select is(public.claim_video_export(600),null::jsonb,'global slot blocks a second worker while lease is active');
select ok(exists(select 1 from public.cleanup_video_export_objects where storage_path=(select job->>'storage_path' from video_test_jobs where label='first')),'upload path has durable cleanup receipt before worker uploads');
select is(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='first'),gen_random_uuid(),10000,5000),false,'wrong worker lease cannot publish');
select is(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='first'),(select (job->>'lease_token')::uuid from video_test_jobs where label='first'),104857601,5000),false,'oversize output cannot be published');
select ok(public.renew_video_export_lease((select (job->>'id')::uuid from video_test_jobs where label='first'),(select (job->>'lease_token')::uuid from video_test_jobs where label='first'),600),'active owner renews bounded lease');
update public.video_exports set lease_expires_at=clock_timestamp()-interval '1 second' where id=(select (job->>'id')::uuid from video_test_jobs where label='first');
insert into video_test_jobs select 'recovered',public.claim_video_export(600);
select isnt((select job->>'lease_token' from video_test_jobs where label='recovered'),(select job->>'lease_token' from video_test_jobs where label='first'),'interrupted job recovery gets a new fencing token');
select is((select job->>'id' from video_test_jobs where label='recovered'),(select job->>'id' from video_test_jobs where label='first'),'interrupted job retains stable receipt ID');
select ok((select delete_after<=clock_timestamp() from public.cleanup_video_export_objects where storage_path=(select job->>'storage_path' from video_test_jobs where label='first')),'recovery immediately tombstones prior worker object');
select is(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='first'),(select (job->>'lease_token')::uuid from video_test_jobs where label='first'),10000,5000),false,'stale worker cannot publish after recovery');
select ok(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='recovered'),(select (job->>'lease_token')::uuid from video_test_jobs where label='recovered'),10000,5000),'current worker atomically publishes finished metadata');
select is(pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000001','guest:'||repeat('a',64),null,'classic','guests/'||repeat('a',64)||'/classic/one.wav',repeat('b',64),repeat('d',64))->>'state','ready','identical successful export is reused');
select throws_ok($q$select public.request_video_export('classic_video_attempt','95959595-0000-4000-8000-000000000001','guest:'||repeat('a',64),null,'classic',jsonb_build_object('recordingPath','guests/'||repeat('a',64)||'/classic/one.wav','audioHash',repeat('b',64)),repeat('d',64),'vertical-v1',true,false)$q$,'55000','EXPORT_INPUT_CONFLICT','score choice cannot silently mutate identical fingerprint');
-- A second choice can run independently while preserving the first finished file.
insert into video_test_jobs select 'deleted',pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000001','guest:'||repeat('a',64),null,'classic','guests/'||repeat('a',64)||'/classic/one.wav',repeat('b',64),repeat('e',64));
update video_test_jobs set job=public.claim_video_export(600) where label='deleted';
delete from public.classic_video_attempts where id='95959595-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.video_exports),0,'source deletion erases derived job and identifying input snapshots');
select is(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='deleted'),(select (job->>'lease_token')::uuid from video_test_jobs where label='deleted'),10000,5000),false,'source deleted during rendering cannot be republished');
select ok((select delete_after<=clock_timestamp() and retain_until>clock_timestamp()+interval '23 hours' from public.cleanup_video_export_objects where storage_path=(select job->>'storage_path' from video_test_jobs where label='deleted')),'running upload tombstone survives source deletion and delayed upload');
select throws_ok($q$select pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000001','guest:'||repeat('a',64),null,'classic','guests/'||repeat('a',64)||'/classic/one.wav',repeat('b',64),repeat('d',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','retry cannot recreate deleted source job');

insert into public.classic_video_attempts(id,user_id,owner_key,attempt_key,request_fingerprint,audio_hash,recording_path,audio_mime,duration_ms,assignment_snapshot)
values('95959595-0000-4000-8000-000000000002','94949494-0000-4000-8000-000000000001','user:94949494-0000-4000-8000-000000000001','take-key-two','request-two',repeat('b',64),'94949494-0000-4000-8000-000000000001/classic/two.wav','audio/wav',5000,'{"mode":"classic","rating":"everyone"}');
insert into video_test_jobs select 'signed',pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000002','user:94949494-0000-4000-8000-000000000001','94949494-0000-4000-8000-000000000001','classic','94949494-0000-4000-8000-000000000001/classic/two.wav',repeat('b',64),repeat('f',64));
select ok((select (job->>'expires_at')::timestamptz<=clock_timestamp()+interval '7 days' from video_test_jobs where label='signed'),'signed export retention is bounded to seven days');
update video_test_jobs set job=public.claim_video_export(600) where label='signed';
select ok(public.fail_video_export((select (job->>'id')::uuid from video_test_jobs where label='signed'),(select (job->>'lease_token')::uuid from video_test_jobs where label='signed'),'https://internal.example/secret'),'worker failure accepts errors without storing raw secrets');
select is((select failure_code from public.video_exports where id=(select (job->>'id')::uuid from video_test_jobs where label='signed')),'RENDER_FAILED','unsafe error strings are replaced with generic code');
select is(pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000002','user:94949494-0000-4000-8000-000000000001','94949494-0000-4000-8000-000000000001','classic','94949494-0000-4000-8000-000000000001/classic/two.wav',repeat('b',64),repeat('f',64))->>'state','queued','same failed receipt retries within bounded attempt budget');
update video_test_jobs set job=public.claim_video_export(600) where label='signed';
insert into public.account_deletion_jobs(user_id) values('94949494-0000-4000-8000-000000000001');
select is((select state from public.video_exports where id=(select (job->>'id')::uuid from video_test_jobs where label='signed')),'cancelled','account containment immediately revokes active exports');
select is(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='signed'),(select (job->>'lease_token')::uuid from video_test_jobs where label='signed'),10000,5000),false,'contained account cannot publish a finished late upload');
select ok(exists(select 1 from public.classic_video_attempts where id='95959595-0000-4000-8000-000000000002'),'export failure leaves original performance untouched');

insert into public.say_clip_versions(id,clip_id,version,manifest) values('video-fixture:one','video-fixture','one','{"rating":"everyone","source":{"license":"unverified reuse"}}');
insert into public.say_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,clip_version_id,clip_snapshot,role_id,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
values('96969696-0000-4000-8000-000000000001',repeat('a',64),'guest:'||repeat('a',64),'say-key','say-hash','video-fixture:one','{"rating":"everyone","source":{"license":"unverified reuse"}}','lead','guests/say-fixture.wav','audio/wav',repeat('b',64),10000,now()+interval '1 day');
select throws_ok($q$select pg_temp.video_request('say_attempt','96969696-0000-4000-8000-000000000001','guest:'||repeat('a',64),null,'say-it-back','guests/say-fixture.wav',repeat('b',64),repeat('1',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','unverified reference reuse does not gain invented export permission');
insert into public.say_clip_versions(id,clip_id,version,manifest) values('video-fixture:two','video-fixture','two','{"rating":"everyone","source":{"license":"CC BY 3.0"}}');
insert into public.say_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,clip_version_id,clip_snapshot,role_id,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
values('96969696-0000-4000-8000-000000000002',repeat('a',64),'guest:'||repeat('a',64),'say-key-two','say-hash-two','video-fixture:two','{"rating":"everyone","source":{"license":"CC BY 3.0"}}','lead','guests/say-fixture-two.wav','audio/wav',repeat('b',64),10000,now()+interval '1 day');
insert into video_test_jobs select 'say',pg_temp.video_request('say_attempt','96969696-0000-4000-8000-000000000002','guest:'||repeat('a',64),null,'say-it-back','guests/say-fixture-two.wav',repeat('b',64),repeat('2',64));
update video_test_jobs set job=public.claim_video_export(600) where label='say';
select ok(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='say'),(select (job->>'lease_token')::uuid from video_test_jobs where label='say'),10000,10000),'eligible reference scene can publish');
update public.say_clip_versions set enabled=false where id='video-fixture:two';
select is((select state from public.video_exports where id=(select (job->>'id')::uuid from video_test_jobs where label='say')),'cancelled','withdrawing source scene immediately revokes its finished exports');
select ok((select delete_after<=clock_timestamp() from public.cleanup_video_export_objects where storage_path=(select job->>'storage_path' from video_test_jobs where label='say')),'withdrawn reference output is queued for physical erasure');
select throws_ok($q$select pg_temp.video_request('say_attempt','96969696-0000-4000-8000-000000000002','guest:'||repeat('a',64),null,'say-it-back','guests/say-fixture-two.wav',repeat('b',64),repeat('2',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','disabled scene cannot regenerate an export');
select lives_ok($q$insert into public.say_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,clip_version_id,clip_snapshot,role_id,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
values('96969696-0000-4000-8000-000000000003',repeat('a',64),'guest:'||repeat('a',64),'say-45-second-key','say-45-second-hash','video-fixture:one','{}','lead','guests/say-45-second-fixture.wav','audio/wav',repeat('b',64),45000,now()+interval '1 day')$q$,'the Say recording boundary stores a complete 45-second take');
select throws_ok($q$insert into public.say_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,clip_version_id,clip_snapshot,role_id,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
values('96969696-0000-4000-8000-000000000004',repeat('a',64),'guest:'||repeat('a',64),'say-over-limit-key','say-over-limit-hash','video-fixture:one','{}','lead','guests/say-over-limit-fixture.wav','audio/wav',repeat('b',64),45001,now()+interval '1 day')$q$,'23514',null,'the Say recording boundary rejects more than 45 seconds');
select lives_ok($q$update public.video_exports set duration_ms=45000 where id=(select (job->>'id')::uuid from video_test_jobs where label='say')$q$,'Say export metadata can represent 45 seconds');
select throws_ok($q$update public.video_exports set duration_ms=45001 where id=(select (job->>'id')::uuid from video_test_jobs where label='say')$q$,'23514',null,'Say export metadata rejects longer durations');
select throws_ok($q$update public.video_exports set duration_ms=45000 where id=(select (job->>'id')::uuid from video_test_jobs where label='signed')$q$,'23514',null,'Classic metadata retains its existing duration boundary');
-- Server-approved imported sources use their real provenance, without a fake CC license.
insert into public.say_clip_versions(id,clip_id,version,manifest) values
('video-fixture:import','video-fixture','import','{"rating":"mature","source":{"license":"User-supplied media","exportAllowed":true}}'),
('video-fixture:string','video-fixture','string','{"rating":"everyone","source":{"license":"User-supplied media","exportAllowed":"true"}}');
insert into public.say_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,clip_version_id,clip_snapshot,role_id,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
select '96969696-0000-4000-8000-000000000005',repeat('a',64),'guest:'||repeat('a',64),'say-import-key','say-import-hash',id,manifest,'you','guests/say-import.wav','audio/wav',repeat('b',64),45000,now()+interval '1 day' from public.say_clip_versions where id='video-fixture:import';
insert into video_test_jobs select 'import',pg_temp.video_request('say_attempt','96969696-0000-4000-8000-000000000005','guest:'||repeat('a',64),null,'say-it-back','guests/say-import.wav',repeat('b',64),repeat('5',64));
select is((select job->>'state' from video_test_jobs where label='import'),'queued','Mature imported scene can queue a personal video');
update video_test_jobs set job=public.claim_video_export(600) where label='import';
select is(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='import'),(select (job->>'lease_token')::uuid from video_test_jobs where label='import'),10000,45001),false,'publication rejects a Say output over 45 seconds');
select ok(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='import'),(select (job->>'lease_token')::uuid from video_test_jobs where label='import'),10000,45000),'current worker publishes a full 45-second imported scene');
select is((select duration_ms from public.video_exports where id=(select (job->>'id')::uuid from video_test_jobs where label='import')),45000,'published import preserves the complete duration');
select throws_ok($q$select pg_temp.video_request('say_attempt','96969696-0000-4000-8000-000000000005','guest:'||repeat('c',64),null,'say-it-back','guests/say-import.wav',repeat('b',64),repeat('5',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','import approval never grants another guest ownership');
insert into public.say_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,clip_version_id,clip_snapshot,role_id,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
select '96969696-0000-4000-8000-000000000006',repeat('a',64),'guest:'||repeat('a',64),'say-string-key','say-string-hash',id,manifest,'you','guests/say-string.wav','audio/wav',repeat('b',64),10000,now()+interval '1 day' from public.say_clip_versions where id='video-fixture:string';
select throws_ok($q$select pg_temp.video_request('say_attempt','96969696-0000-4000-8000-000000000006','guest:'||repeat('a',64),null,'say-it-back','guests/say-string.wav',repeat('b',64),repeat('6',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','a string containing true is not an export approval');
insert into public.say_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,clip_version_id,clip_snapshot,role_id,recording_path,audio_mime,audio_hash,duration_ms,expires_at)
values('96969696-0000-4000-8000-000000000007',repeat('a',64),'guest:'||repeat('a',64),'say-spoof-key','say-spoof-hash','video-fixture:one','{"rating":"everyone","source":{"license":"unverified reuse","exportAllowed":true}}','you','guests/say-spoof.wav','audio/wav',repeat('b',64),10000,now()+interval '1 day');
select throws_ok($q$select pg_temp.video_request('say_attempt','96969696-0000-4000-8000-000000000007','guest:'||repeat('a',64),null,'say-it-back','guests/say-spoof.wav',repeat('b',64),repeat('7',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','a recording snapshot cannot invent catalog approval');
update public.say_attempts set moderation_state='rejected' where id='96969696-0000-4000-8000-000000000005';
select is((select state from public.video_exports where id=(select (job->>'id')::uuid from video_test_jobs where label='import')),'cancelled','explicit moderation rejection still revokes a Mature personal video');
select throws_ok($q$select pg_temp.video_request('say_attempt','96969696-0000-4000-8000-000000000005','guest:'||repeat('a',64),null,'say-it-back','guests/say-import.wav',repeat('b',64),repeat('5',64))$q$,'55000','EXPORT_SOURCE_UNAVAILABLE','a rejected imported take cannot regenerate a download');

-- Mature classification does not make the owner's private Classic download public.
insert into public.classic_video_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,audio_hash,recording_path,audio_mime,duration_ms,assignment_snapshot,expires_at)
values('95959595-0000-4000-8000-000000000003',repeat('a',64),'guest:'||repeat('a',64),'take-mature-key','request-mature',repeat('b',64),'guests/classic-mature.wav','audio/wav',5000,'{"mode":"classic","rating":"mature"}',now()+interval '1 day');
insert into video_test_jobs select 'mature-classic',pg_temp.video_request('classic_video_attempt','95959595-0000-4000-8000-000000000003','guest:'||repeat('a',64),null,'classic','guests/classic-mature.wav',repeat('b',64),repeat('8',64));
update video_test_jobs set job=public.claim_video_export(600) where label='mature-classic';
select is(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='mature-classic'),(select (job->>'lease_token')::uuid from video_test_jobs where label='mature-classic'),10000,45000),false,'Classic publication keeps its existing 30-second bound');
select ok(public.publish_video_export((select (job->>'id')::uuid from video_test_jobs where label='mature-classic'),(select (job->>'lease_token')::uuid from video_test_jobs where label='mature-classic'),10000,5000),'Mature Classic performances support private downloads');
select ok(not has_function_privilege('authenticated','public.publish_video_export(uuid,uuid,bigint,integer)','EXECUTE'),'updated publication function remains server-only');
select ok(not has_function_privilege('anon','public.video_export_source(text,uuid,text,uuid)','EXECUTE'),'updated source lookup remains server-only');
select * from finish();
rollback;
