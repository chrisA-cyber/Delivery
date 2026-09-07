begin;
insert into auth.users(id,email,raw_user_meta_data) values('bcbcbcbc-0000-4000-8000-000000000001','clip-editor-check@example.test','{"user_name":"clip_editor_check"}');
insert into public.classic_video_attempts(id,guest_owner_hash,owner_key,attempt_key,request_fingerprint,audio_hash,recording_path,audio_mime,duration_ms,assignment_snapshot,expires_at)
values('bdbdbdbd-0000-4000-8000-000000000001',repeat('8',64),'guest:'||repeat('8',64),'clip-edit-key','clip-edit-request',repeat('9',64),'guests/'||repeat('8',64)||'/classic/editor.wav','audio/wav',5000,'{"mode":"classic","rating":"everyone"}',now()+interval '1 day');
do $$
declare test_settings jsonb:='{"version":1,"layout":"duet","avatar":{"kind":"builtin","id":"fox"},"trimStart":1,"trimEnd":4}'; rejected boolean:=false;
begin
  if has_table_privilege('anon','public.performance_clip_edits','SELECT') or has_table_privilege('authenticated','public.performance_avatar_preferences','SELECT') then raise exception 'Private preferences must not be directly readable'; end if;
  if has_function_privilege('anon','public.save_performance_clip_edits(text,uuid,text,uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.claim_performance_avatar(uuid,text)','EXECUTE') then raise exception 'Client cannot bypass ownership'; end if;
  if not (select relrowsecurity from pg_class where oid='public.performance_clip_edits'::regclass) or not (select relrowsecurity from pg_class where oid='public.performance_avatar_preferences'::regclass) then raise exception 'RLS missing'; end if;
  perform public.save_performance_avatar('guest:'||repeat('8',64),null,'{"kind":"builtin","id":"robot"}');
  if not exists(select 1 from public.performance_avatar_preferences where owner_key='guest:'||repeat('8',64) and expires_at>now()) then raise exception 'Guest preference missing'; end if;
  perform public.save_performance_clip_edits('classic_video_attempt','bdbdbdbd-0000-4000-8000-000000000001','guest:'||repeat('8',64),null,test_settings);
  if not exists(select 1 from public.performance_clip_edits where attempt_id='bdbdbdbd-0000-4000-8000-000000000001' and settings=test_settings and expires_at>now()) then raise exception 'Saved edit recovery mismatch'; end if;
  begin
    perform public.save_performance_clip_edits('classic_video_attempt','bdbdbdbd-0000-4000-8000-000000000001','guest:'||repeat('7',64),null,test_settings);
  exception when sqlstate '55000' then rejected:=true; end;
  if not rejected then raise exception 'Stranger could save another take'; end if;
  if not exists(select 1 from public.classic_video_attempts where id='bdbdbdbd-0000-4000-8000-000000000001' and duration_ms=5000 and audio_hash=repeat('9',64) and assignment_snapshot='{"mode":"classic","rating":"everyone"}') then raise exception 'Editing changed source'; end if;
end;
$$;
update public.classic_video_attempts set user_id='bcbcbcbc-0000-4000-8000-000000000001',guest_owner_hash=null,owner_key='user:bcbcbcbc-0000-4000-8000-000000000001',recording_path='bcbcbcbc-0000-4000-8000-000000000001/classic/editor.wav',expires_at=null where id='bdbdbdbd-0000-4000-8000-000000000001';
select public.claim_performance_avatar('bcbcbcbc-0000-4000-8000-000000000001','guest:'||repeat('8',64));
do $$
begin
  if not exists(select 1 from public.performance_clip_edits where attempt_id='bdbdbdbd-0000-4000-8000-000000000001' and owner_key='user:bcbcbcbc-0000-4000-8000-000000000001' and expires_at is null) then raise exception 'Guest edit adoption failed'; end if;
  if not exists(select 1 from public.performance_avatar_preferences where owner_key='user:bcbcbcbc-0000-4000-8000-000000000001' and avatar->>'id'='robot') or exists(select 1 from public.performance_avatar_preferences where owner_key='guest:'||repeat('8',64)) then raise exception 'Avatar adoption failed'; end if;
end;
$$;
insert into public.account_deletion_jobs(user_id) values('bcbcbcbc-0000-4000-8000-000000000001');
do $$
declare rejected boolean:=false;
begin
  if exists(select 1 from public.performance_clip_edits where user_id='bcbcbcbc-0000-4000-8000-000000000001') or exists(select 1 from public.performance_avatar_preferences where user_id='bcbcbcbc-0000-4000-8000-000000000001') then raise exception 'Account deletion retained custom image/edit'; end if;
  begin perform public.save_performance_avatar('user:bcbcbcbc-0000-4000-8000-000000000001','bcbcbcbc-0000-4000-8000-000000000001','{"kind":"builtin","id":"fox"}'); exception when sqlstate '55000' then rejected:=true; end;
  if not rejected then raise exception 'Account deletion barrier bypassed'; end if;
end;
$$;
select public.save_performance_avatar('guest:'||repeat('6',64),null,'{"kind":"builtin","id":"cat"}');
update public.performance_avatar_preferences set expires_at=now()-interval '1 second' where owner_key='guest:'||repeat('6',64);
select public.expire_performance_clip_edits(100);
do $$ begin if exists(select 1 from public.performance_avatar_preferences where owner_key='guest:'||repeat('6',64)) then raise exception 'Guest avatar expiry sweep failed'; end if; end $$;
select 'ownership, persistence, source integrity, guest adoption, deletion barrier and expiry passed' as verification;
rollback;
