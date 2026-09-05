begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select is((select count(*)::integer from public.prompts where draw_enabled and 'recognizable'=any(tags)),14,'14 reviewed recognizable phrases are in active draws');
select is((select count(*)::integer from public.prompts where draw_enabled and 'recognizable'=any(tags) and metadata->'recognitionSource'->>'publicationDecision'='publish-text-only'),14,'all recognizable phrases have an explicit text-only publication decision');
select is((select count(*)::integer from public.prompts where draw_enabled and 'recognizable'=any(tags) and coalesce(metadata->'recognitionSource'->>'sourceUrl','') like 'https://%'),14,'all recognizable phrases retain a usable source link');
select is((select count(*)::integer from public.prompts where draw_enabled and 'recognizable'=any(tags) and rating='mature'),1,'vulgar reference is Mature in the real database');
select is((select body from public.prompts where slug='v2-apology-draft'),'I would like to apologize to everyone who saw me run for that bus.','replaced v2 line retains its exact original text');
select is((select draw_enabled from public.prompts where slug='v2-apology-draft'),false,'replaced v2 line is excluded from new draws');
select is((select instruction from public.energy_modifiers where slug='v2-hold-laugh'),'Try desperately not to laugh. Let one breath escape, then finish with rigid seriousness.','replaced v2 direction remains exact for history');
select is((select draw_enabled from public.energy_modifiers where slug='v2-hold-laugh'),false,'replaced v2 direction is excluded from new draws');
select is((select count(*)::integer from public.energy_modifiers),96,'48 legacy,36 v2 and12 replacement direction identities are retained');

-- Force a genuinely short eligible pool so compatibility is not a vacuous check.
update public.prompts set draw_enabled=false where slug <> 'v3-ref-touch-grass';
do $$ begin
  for day_offset in 0..9 loop
    perform public.ensure_daily_challenge('2099-06-01'::date + day_offset,'v3-short-test');
  end loop;
end $$;
select is((select count(*)::integer from public.daily_challenges where market='v3-short-test'),10,'ten canonical short-line Daily assignments generated');
select ok(not exists (
 select 1 from public.daily_challenges d join public.energy_modifiers e on e.id=d.energy_modifier_id
 where d.market='v3-short-test' and e.tags && array['contrast','multi-beat']::text[]
),'short recognizable Daily phrases never receive a multi-beat or contrast direction');
select ok(not exists (
 select 1 from public.daily_challenges d join public.prompts p on p.id=d.prompt_id
 where d.market='v3-short-test' and (p.slug <> 'v3-ref-touch-grass' or p.rating <> 'everyone')
),'forced short-line Daily stays within the clean eligible pool');
select * from finish();
rollback;
