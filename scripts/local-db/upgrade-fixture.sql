-- SQL-only history fixture: no recording or external account exists.
insert into auth.users(id,email,raw_user_meta_data)
values('57575757-5757-4757-8757-575757575701','upgrade-owner@example.test','{"user_name":"upgrade_owner"}');
insert into public.challenges(id,code,token_digest,created_by,prompt_id,energy_modifier_id)
values (
 '58585858-5858-4858-8858-585858585801','Upgrade1',extensions.digest('local-test-token','sha256'),
 '57575757-5757-4757-8757-575757575701',
 (select id from public.prompts where slug='timeline-needs-me'),
 (select id from public.energy_modifiers where slug='lying-to-police')
);
insert into public.deliveries(id,user_id,prompt_id,energy_modifier_id,challenge_id,state,visibility,recording_path)
select '59595959-5959-4959-8959-595959595901',created_by,prompt_id,energy_modifier_id,id,
 'processing','private','57575757-5757-4757-8757-575757575701/59595959-5959-4959-8959-595959595901.wav'
from public.challenges where id='58585858-5858-4858-8858-585858585801';
insert into public.delivery_scores(delivery_id,overall,commitment,comedy,accuracy,chaos,headline,verdict,rubric_version,provider,model)
values('59595959-5959-4959-8959-595959595901',82,80,85,90,70,'Frozen SQL receipt','Historical test evidence; no audio was judged.','delivery-voice-v1','test','test');
insert into public.challenge_entries(challenge_id,entrant_id,delivery_id)
values('58585858-5858-4858-8858-585858585801','57575757-5757-4757-8757-575757575701','59595959-5959-4959-8959-595959595901');
select public.ensure_daily_challenge('2099-03-02','upgrade-fixture');
