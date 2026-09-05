begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_trigger('public'::name, 'deliveries'::name, 'deliveries_enforce_mature_private'::name);
insert into auth.users (id,email,raw_user_meta_data,created_at,updated_at)
values ('36363636-3636-4363-8363-363636363636','mature-policy@example.test','{"user_name":"mature_policy_test"}'::jsonb,now(),now());
insert into public.prompts (id,slug,body,category,difficulty,rating,state,source)
values
 ('37373737-3737-4373-8373-373737373701','mature-policy-adult','The adult policy test line.','main-character',1,'mature','published','built_in'),
 ('37373737-3737-4373-8373-373737373702','mature-policy-clean','The clean policy test line.','main-character',1,'everyone','published','built_in'),
 ('37373737-3737-4373-8373-373737373703','mature-policy-unchanged','The unchanged clean test line.','main-character',1,'everyone','published','built_in');
insert into public.deliveries (id,user_id,prompt_id,state,visibility,recording_path,moderation_labels)
select item.id,'36363636-3636-4363-8363-363636363636',item.prompt_id,'processing','private',
 '36363636-3636-4363-8363-363636363636/'||item.id::text||'.wav',array['publish-approved']
from (values
 ('38383838-3838-4383-8383-383838383801'::uuid,'37373737-3737-4373-8373-373737373701'::uuid),
 ('38383838-3838-4383-8383-383838383802'::uuid,'37373737-3737-4373-8373-373737373702'::uuid),
 ('38383838-3838-4383-8383-383838383803'::uuid,'37373737-3737-4373-8373-373737373703'::uuid)
) as item(id,prompt_id);
insert into public.delivery_scores (delivery_id,overall,commitment,comedy,accuracy,chaos,headline,verdict,rubric_version,provider,model)
select id,80,80,80,80,80,'Policy test','A clear private recording.','delivery-voice-v1','test','test'
from public.deliveries where user_id = '36363636-3636-4363-8363-363636363636';
select ok((select 'mature-content' = any(moderation_labels) from public.deliveries where id='38383838-3838-4383-8383-383838383801'),'canonical Mature insert receives a sticky marker');
select throws_ok($$update public.deliveries set visibility='public' where id='38383838-3838-4383-8383-383838383801'$$,'42501','Mature recordings must stay private until an age and audience publication policy is approved','trusted raw public write cannot bypass rating');
select throws_ok($$update public.deliveries set visibility='unlisted' where id='38383838-3838-4383-8383-383838383801'$$,'42501','Mature recordings must stay private until an age and audience publication policy is approved','trusted unlisted write also fails');
select throws_ok($$update public.deliveries set share_asset_path='36363636-3636-4363-8363-363636363636/share.png' where id='38383838-3838-4383-8383-383838383801'$$,'42501','Mature recordings must stay private until an age and audience publication policy is approved','private Mature recording cannot attach a public share asset');
set local "request.jwt.claim.role" = 'service_role';
select throws_ok($$select * from public.set_delivery_visibility('38383838-3838-4383-8383-383838383801','public','36363636-3636-4363-8363-363636363636')$$,'42501','Mature recordings must stay private until an age and audience publication policy is approved','service RPC cannot publish Mature even with moderation approval');
select lives_ok($$select * from public.set_delivery_visibility('38383838-3838-4383-8383-383838383801','private','36363636-3636-4363-8363-363636363636')$$,'private transition remains available');
select lives_ok($$select * from public.set_delivery_visibility('38383838-3838-4383-8383-383838383802','public','36363636-3636-4363-8363-363636363636')$$,'normal approved non-Mature publishing survives');
do $$ begin perform public.set_delivery_visibility('38383838-3838-4383-8383-383838383803','public','36363636-3636-4363-8363-363636363636'); end $$;
update public.prompts set rating='mature' where id='37373737-3737-4373-8373-373737373702';
select is((select visibility::text from public.deliveries where id='38383838-3838-4383-8383-383838383802'),'private','rating escalation contains already public takes');
update public.prompts set rating='everyone' where id='37373737-3737-4373-8373-373737373702';
update public.deliveries set moderation_labels=array['publish-approved'] where id='38383838-3838-4383-8383-383838383802';
select ok((select 'mature-content' = any(moderation_labels) from public.deliveries where id='38383838-3838-4383-8383-383838383802'),'rating downgrade and label rewrite do not erase original audience restriction');
select throws_ok($$update public.deliveries set visibility='public' where id='38383838-3838-4383-8383-383838383802'$$,'42501','Mature recordings must stay private until an age and audience publication policy is approved','sticky receipt cannot be published after downgrade');
select is((select visibility::text from public.deliveries where id='38383838-3838-4383-8383-383838383803'),'public','unrelated historical non-Mature public recording stays public');
select * from finish();
rollback;
