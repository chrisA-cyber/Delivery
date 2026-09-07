begin;
insert into auth.users(id,email,raw_user_meta_data) values('caca0000-0000-4000-8000-000000000001','camera-check@example.test','{"user_name":"camera_check"}');
insert into public.classic_video_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,audio_hash,recording_path,audio_mime,duration_ms,assignment_snapshot,expires_at)
values('caca0000-0000-4000-8000-000000000002',repeat('c',64),'guest:'||repeat('c',64),'camera-check-key','camera-check-request',repeat('d',64),'guests/'||repeat('c',64)||'/classic/caca0000-0000-4000-8000-000000000002.wav','audio/wav',5000,'{"mode":"classic","rating":"everyone"}',now()+interval '1 day');
do $$
declare reservation jsonb; denied boolean:=false; media jsonb:='[
 {"start":0,"end":1.5,"sourceStart":0.03,"mirror":true,"path":"camera/caca0000-0000-4000-8000-000000000002/caca0000-0000-4000-8000-000000000003/0.webm","hash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"},
 {"start":1.5,"end":2.5,"sourceStart":0.02,"mirror":false,"path":"camera/caca0000-0000-4000-8000-000000000002/caca0000-0000-4000-8000-000000000003/1.mp4","hash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"},
 {"start":2.5,"end":5,"sourceStart":2.53,"mirror":true,"path":"camera/caca0000-0000-4000-8000-000000000002/caca0000-0000-4000-8000-000000000003/0.webm","hash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}]';
begin
 if has_table_privilege('anon','public.performance_camera_media','SELECT') or has_table_privilege('authenticated','public.cleanup_camera_objects','SELECT') or has_function_privilege('authenticated','public.reserve_performance_camera(text,uuid,text,uuid,text,jsonb)','EXECUTE') then raise exception 'Camera privilege leak'; end if;
 if (select public from storage.buckets where id='delivery-camera') or not(select relrowsecurity from pg_class where oid='public.performance_camera_media'::regclass) then raise exception 'Camera privacy missing'; end if;
 reservation:=public.reserve_performance_camera('classic_video_attempt','caca0000-0000-4000-8000-000000000002','guest:'||repeat('c',64),null,repeat('e',64),media);
 if reservation->>'ready'<>'false' or reservation->'manifest'<>media then raise exception 'Reservation must precede uploading'; end if;
 if reservation<>public.reserve_performance_camera('classic_video_attempt','caca0000-0000-4000-8000-000000000002','guest:'||repeat('c',64),null,repeat('e',64),media) then raise exception 'Upload retry changed reservation'; end if;
 begin perform public.reserve_performance_camera('classic_video_attempt','caca0000-0000-4000-8000-000000000002','guest:'||repeat('b',64),null,repeat('e',64),media); exception when sqlstate '55000' then denied:=true; end;
 if not denied then raise exception 'Another guest accessed this camera'; end if;
 denied:=false;
 begin perform public.reserve_performance_camera('classic_video_attempt','caca0000-0000-4000-8000-000000000002','guest:'||repeat('c',64),null,repeat('a',64),media); exception when sqlstate '55000' then denied:=true; end;
 if not denied then raise exception 'Changed camera replaced an immutable take'; end if;
 if not public.finish_performance_camera('classic_video_attempt','caca0000-0000-4000-8000-000000000002','guest:'||repeat('c',64),null,repeat('e',64)) then raise exception 'Camera could not complete'; end if;
end $$;
update public.classic_video_attempts set user_id='caca0000-0000-4000-8000-000000000001',guest_owner_hash=null,owner_key='user:caca0000-0000-4000-8000-000000000001',recording_path='caca0000-0000-4000-8000-000000000001/classic/caca0000-0000-4000-8000-000000000002.wav',expires_at=null where id='caca0000-0000-4000-8000-000000000002';
do $$ begin
 if not exists(select 1 from public.performance_camera_media where attempt_id='caca0000-0000-4000-8000-000000000002' and ready and user_id='caca0000-0000-4000-8000-000000000001' and expires_at is null) then raise exception 'Guest camera adoption failed'; end if;
 if public.finish_performance_camera('classic_video_attempt','caca0000-0000-4000-8000-000000000002','guest:'||repeat('c',64),null,repeat('e',64)) then raise exception 'Former guest retained write access'; end if;
 if (select audio_hash from public.classic_video_attempts where id='caca0000-0000-4000-8000-000000000002')<>repeat('d',64) then raise exception 'Camera changed original audio'; end if;
end $$;
update public.classic_video_attempts set deleted_at=now() where id='caca0000-0000-4000-8000-000000000002';
do $$ begin
 if exists(select 1 from public.performance_camera_media where attempt_id='caca0000-0000-4000-8000-000000000002') then raise exception 'Deleted source retained camera'; end if;
 if not exists(select 1 from public.cleanup_camera_objects where storage_path='camera/caca0000-0000-4000-8000-000000000002/caca0000-0000-4000-8000-000000000003/0.webm' and retain_until>=now()+interval '23 hours') then raise exception 'Lost cleanup tombstone'; end if;
 if (select count(*) from public.cleanup_camera_objects where storage_path like 'camera/caca0000-0000-4000-8000-000000000002/%')<>2 then raise exception 'Retake cleanup must keep one tombstone per distinct file'; end if;
 if public.finish_performance_camera('classic_video_attempt','caca0000-0000-4000-8000-000000000002','user:caca0000-0000-4000-8000-000000000001','caca0000-0000-4000-8000-000000000001',repeat('e',64)) then raise exception 'Interrupted upload resurrected a deleted take'; end if;
end $$;
select 'Camera privacy, reservation/retry, isolation, immutable pairing, guest adoption, audio integrity, deletion and stale-upload rejection passed' as verification;
rollback;
