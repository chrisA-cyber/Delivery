-- Commit this migration before 015: PostgreSQL cannot use a newly added enum value
-- in the same transaction that introduces it. Do not concatenate 014 and 015.
alter type public.content_rating add value if not exists 'mature';
alter table public.prompts add column if not exists draw_enabled boolean not null default true;
alter table public.energy_modifiers add column if not exists draw_enabled boolean not null default true;
alter table public.content_packs add column if not exists draw_enabled boolean not null default true;
comment on column public.prompts.draw_enabled is 'False retires a line from new draws; published body and ID stay intact for history and existing challenges.';
create index if not exists prompts_draw_rating_idx on public.prompts (rating, difficulty) where state = 'published' and draw_enabled;
