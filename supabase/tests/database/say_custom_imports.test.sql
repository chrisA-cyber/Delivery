begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select ok(not has_table_privilege('anon','public.say_imports','SELECT'),'anonymous clients cannot list custom sources');
select ok(not has_table_privilege('authenticated','public.say_imports','SELECT'),'authenticated clients cannot enumerate other owners sources');
select ok((select relrowsecurity from pg_class where oid='public.say_imports'::regclass),'custom sources have default-deny RLS');
select ok(not has_function_privilege('anon','public.claim_say_import(integer)','EXECUTE'),'anonymous clients cannot claim import jobs');
select ok(not has_function_privilege('authenticated','public.claim_say_import(integer)','EXECUTE'),'authenticated clients cannot claim import jobs');
select ok(has_function_privilege('service_role','public.claim_say_import(integer)','EXECUTE'),'existing service worker can claim imports');
select is((select public from storage.buckets where id='delivery-scenes'),false,'custom scene media remains in a private bucket');

insert into public.say_imports(id,owner_key,request_key,media_key,created_at,expires_at,deleted_at,lease_expires_at,job_kind) values
('78787878-0000-4000-8000-000000000001','guest:'||repeat('a',64),'78787878-0000-4000-9000-000000000001',repeat('b',48),now()-interval '5 minutes',now()-interval '1 minute',null,null,'fetch'),
('78787878-0000-4000-8000-000000000002','guest:'||repeat('a',64),'78787878-0000-4000-9000-000000000002',repeat('b',48),now()-interval '4 minutes',null,now(),null,'fetch'),
('78787878-0000-4000-8000-000000000003','guest:'||repeat('a',64),'78787878-0000-4000-9000-000000000003',repeat('b',48),now()-interval '3 minutes',null,null,now()+interval '5 minutes','fetch'),
('78787878-0000-4000-8000-000000000004','guest:'||repeat('a',64),'78787878-0000-4000-9000-000000000004',repeat('b',48),now()-interval '2 minutes',null,null,null,'fetch'),
('78787878-0000-4000-8000-000000000005','guest:'||repeat('a',64),'78787878-0000-4000-9000-000000000005',repeat('b',48),now()-interval '1 minute',null,null,null,'prepare');

select throws_ok($q$insert into public.say_imports(owner_key,request_key,media_key) values('guest:'||repeat('a',64),'78787878-0000-4000-9000-000000000004',repeat('c',48))$q$,'23505',null,'the same owner request cannot create duplicate processing work');
select lives_ok($q$update public.say_imports set excerpt_start=10,excerpt_end=55 where id='78787878-0000-4000-8000-000000000005'$q$,'45-second excerpts fit the stored scene timeline');
select throws_ok($q$update public.say_imports set excerpt_end=56 where id='78787878-0000-4000-8000-000000000005'$q$,'23514',null,'oversize excerpts fail before preparation');
create temporary table import_test_claims(label text primary key,job jsonb);
insert into import_test_claims select 'fetch',public.claim_say_import(360);
select is((select job->>'id' from import_test_claims where label='fetch'),'78787878-0000-4000-8000-000000000004','claim skips expired, deleted and already leased sources');
select is((select job->>'status' from import_test_claims where label='fetch'),'fetching','fetch claim enters fetching status');
select is((select (job->>'job_attempts')::integer from import_test_claims where label='fetch'),1,'claim increments its bounded attempt count');
select ok((select (job->>'lease_expires_at')::timestamptz between now()+interval '359 seconds' and now()+interval '361 seconds' from import_test_claims where label='fetch'),'claim records the bounded processing lease');
insert into import_test_claims select 'prepare',public.claim_say_import(1);
select is((select job->>'status' from import_test_claims where label='prepare'),'processing','prepare claim enters processing status');
select ok((select (job->>'lease_expires_at')::timestamptz between now()+interval '59 seconds' and now()+interval '61 seconds' from import_test_claims where label='prepare'),'small lease requests retain the 60-second minimum');
select is(public.claim_say_import(360),null::jsonb,'an active lease cannot be claimed again');
update public.say_imports set lease_expires_at=now()-interval '1 second' where id='78787878-0000-4000-8000-000000000004';
insert into import_test_claims select 'recovered',public.claim_say_import(9999);
select isnt((select job->>'lease_token' from import_test_claims where label='recovered'),(select job->>'lease_token' from import_test_claims where label='fetch'),'lease recovery fences the previous worker with a new token');
select is((select (job->>'job_attempts')::integer from import_test_claims where label='recovered'),2,'lease recovery consumes another bounded attempt');
select ok((select (job->>'lease_expires_at')::timestamptz between now()+interval '599 seconds' and now()+interval '601 seconds' from import_test_claims where label='recovered'),'large lease requests are capped at ten minutes');
update public.say_imports set job_attempts=3,lease_expires_at=now()-interval '1 second' where id='78787878-0000-4000-8000-000000000005';
select is(public.claim_say_import(360),null::jsonb,'three failed processing attempts cannot be reclaimed');
select is((select status from public.say_imports where id='78787878-0000-4000-8000-000000000005'),'failed','exhausted expired work exposes a retryable failure');
select is((select job_kind from public.say_imports where id='78787878-0000-4000-8000-000000000005'),null::text,'exhausted work leaves the worker queue');

select ok(not has_function_privilege('authenticated','public.publish_say_import(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE'),'browser clients cannot publish arbitrary scene manifests');
select ok(has_function_privilege('service_role','public.publish_say_import(uuid,text,uuid,jsonb,jsonb,jsonb,jsonb)','EXECUTE'),'the trusted application can commit an edited scene');
insert into public.say_imports(id,owner_key,request_key,media_key,status,job_kind,lease_token,lease_expires_at,expires_at) values
('78787878-0000-4000-8000-000000000006','guest:'||repeat('a',64),'78787878-0000-4000-9000-000000000006',repeat('b',48),'publishing',null,'78787878-0000-4000-a000-000000000006',now()+interval '2 minutes',now()+interval '1 day');
create function pg_temp.publish_test_import(p_title text, p_owner text default 'guest:'||repeat('a',64), p_token uuid default '78787878-0000-4000-a000-000000000006') returns jsonb language sql as $$
select public.publish_say_import('78787878-0000-4000-8000-000000000006',p_owner,p_token,
  jsonb_build_object('id','custom-78787878-0000-4000-8000-000000000006','version','v1','title',p_title,'rating','mature'),
  '{"video":"own-scene.mp4"}','{"video":"checksum"}','[]');
$$;
select throws_ok($q$select pg_temp.publish_test_import('Scene','guest:'||repeat('c',64))$q$,'P0001','SCENE_NOT_FOUND','another owner cannot publish the prepared scene');
select throws_ok($q$select pg_temp.publish_test_import('Scene','guest:'||repeat('a',64),gen_random_uuid())$q$,'P0001','SCENE_PUBLISH_LEASE_LOST','a stale publication token cannot commit');
update public.say_imports set lease_expires_at=now()-interval '1 second' where id='78787878-0000-4000-8000-000000000006';
select throws_ok($q$select pg_temp.publish_test_import('Scene')$q$,'P0001','SCENE_PUBLISH_LEASE_LOST','an expired publication lease cannot commit');
update public.say_imports set lease_expires_at=now()+interval '2 minutes',deleted_at=now() where id='78787878-0000-4000-8000-000000000006';
select throws_ok($q$select pg_temp.publish_test_import('Scene')$q$,'P0001','SCENE_NOT_FOUND','deletion prevents a late publication');
update public.say_imports set deleted_at=null where id='78787878-0000-4000-8000-000000000006';
select throws_ok($q$select pg_temp.publish_test_import(null)$q$,'23502',null,'failed import metadata update rolls back its preceding manifest insertion');
select is((select count(*)::integer from public.say_clip_versions where id='custom-78787878-0000-4000-8000-000000000006:v1'),0,'failed publication leaves no orphan immutable clip');
select is((select status from public.say_imports where id='78787878-0000-4000-8000-000000000006'),'publishing','failed publication preserves the prepared source and active lease');
select is(pg_temp.publish_test_import('Original scene')->>'title','Original scene','publication returns the committed scene');
select is((select status from public.say_imports where id='78787878-0000-4000-8000-000000000006'),'published','manifest and import become playable atomically');
select is((select published_clip_id from public.say_imports where id='78787878-0000-4000-8000-000000000006'),'custom-78787878-0000-4000-8000-000000000006:v1','published source points to its immutable version');
select is((select owner_key from public.say_clip_versions where id='custom-78787878-0000-4000-8000-000000000006:v1'),'guest:'||repeat('a',64),'the private manifest retains its owner');
select is(pg_temp.publish_test_import('Changed retry input','guest:'||repeat('a',64),gen_random_uuid())->>'title','Original scene','a retry returns the first committed manifest without editing it');
select is((select count(*)::integer from public.say_clip_versions where custom_import_id='78787878-0000-4000-8000-000000000006'),1,'publication retries create one scene version');
update public.say_clip_versions set enabled=false where id='custom-78787878-0000-4000-8000-000000000006:v1';
select throws_ok($q$select pg_temp.publish_test_import('Scene')$q$,'P0001','SCENE_NOT_FOUND','a withdrawn scene cannot be revived through an idempotent retry');
select * from finish();
rollback;
