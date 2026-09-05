begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

insert into auth.users (id,email,raw_user_meta_data)
values
 ('45454545-4545-4545-8545-454545454501','classic-owner@example.test','{"user_name":"classic_owner"}'),
 ('45454545-4545-4545-8545-454545454502','classic-stranger@example.test','{"user_name":"classic_stranger"}');
insert into public.deliveries (id,user_id,prompt_id,state,visibility,recording_path)
values (
 '46464646-4646-4646-8646-464646464601',
 '45454545-4545-4545-8545-454545454501',
 (select id from public.prompts where draw_enabled and rating = 'everyone' order by slug limit 1),
 'processing','private','45454545-4545-4545-8545-454545454501/46464646-4646-4646-8646-464646464601.wav'
);
insert into public.delivery_scores (delivery_id,overall,commitment,comedy,accuracy,chaos,headline,verdict,rubric_version,provider,model)
values ('46464646-4646-4646-8646-464646464601',80,80,80,80,80,'SQL fixture','No audio or provider was used.','delivery-voice-v1','test','test');

-- Real PostgreSQL role changes make RLS apply; claims alone do not bypass the
-- test connection's superuser privilege. pgTAP uses temporary state for its plan.
grant select, insert, update, delete on all tables in schema pg_temp to anon, authenticated;
grant usage, select on all sequences in schema pg_temp to anon, authenticated;
set local role anon;
set local "request.jwt.claim.role" = 'anon';
select is((select count(*)::integer from public.deliveries where id='46464646-4646-4646-8646-464646464601'),0,'anonymous RLS cannot read the private receipt');
select is((select count(*)::integer from public.delivery_scores where delivery_id='46464646-4646-4646-8646-464646464601'),0,'anonymous RLS cannot read its score');
reset role;
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '45454545-4545-4545-8545-454545454502';
select is((select count(*)::integer from public.deliveries where id='46464646-4646-4646-8646-464646464601'),0,'another account cannot read the private receipt');
set local "request.jwt.claim.sub" = '45454545-4545-4545-8545-454545454501';
select is((select count(*)::integer from public.deliveries where id='46464646-4646-4646-8646-464646464601'),1,'the authenticated owner can read the private receipt');
select is((select count(*)::integer from public.delivery_scores where delivery_id='46464646-4646-4646-8646-464646464601'),1,'the authenticated owner can read its score');
select throws_ok($$update public.deliveries set visibility='public' where id='46464646-4646-4646-8646-464646464601'$$,'42501','permission denied for table deliveries','browser owner cannot bypass checked publication');
select throws_ok($$update public.delivery_scores set overall=100 where delivery_id='46464646-4646-4646-8646-464646464601'$$,'42501','permission denied for table delivery_scores','browser owner cannot rewrite a score');
select throws_ok($$select * from public.reserve_judged_play('classic-rls-denied','45454545-4545-4545-8545-454545454501')$$,'42501','permission denied for function reserve_judged_play','browser owner cannot bypass the server quota boundary');
select throws_ok($$insert into storage.objects (bucket_id,name) values ('delivery-audio','45454545-4545-4545-8545-454545454501/direct.wav')$$,'42501','new row violates row-level security policy for table "objects"','browser owner cannot directly upload audio through Storage SQL');
reset role;
select * from finish();
rollback;
