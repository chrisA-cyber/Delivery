-- Private Mature play is enabled; public/unlisted Mature distribution is held
-- until a separately approved age/audience launch policy exists. Applies to the
-- checked RPC and raw trusted writes without changing earlier moderation gates.
-- This migration never deletes a recording or changes a historical score.

-- A pre-existing public Storage object cannot be revoked by clearing its SQL
-- pointer. Fail visibly so an operator can remove it through the Storage API
-- before applying this transaction. Do not silently claim object erasure.
do $$
begin
  if exists (
    select 1 from public.deliveries d join public.prompts p on p.id = d.prompt_id
    where (p.rating = 'mature' or 'mature-content' = any(d.moderation_labels))
      and d.share_asset_path is not null
  ) then
    raise exception using errcode = '55000', message = 'Remove existing mature delivery-share objects through the Storage API and clear their share_asset_path before applying 016';
  end if;
end;
$$;

-- Backfill only Mature receipts; historical non-Mature public results are intact.
do $$
declare affected_user uuid;
begin
  for affected_user in
    select distinct d.user_id from public.deliveries d
    join public.prompts p on p.id = d.prompt_id
    where p.rating = 'mature' or 'mature-content' = any(d.moderation_labels)
  loop
    update public.deliveries d
    set visibility = 'private', published_at = null,
        moderation_labels = array_append(array_remove(d.moderation_labels, 'mature-content'), 'mature-content')
    from public.prompts p
    where p.id = d.prompt_id and d.user_id = affected_user
      and (p.rating = 'mature' or 'mature-content' = any(d.moderation_labels));
    perform public.refresh_user_rollups(affected_user);
  end loop;
end;
$$;

create or replace function public.enforce_mature_delivery_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare mature boolean;
begin
  select p.rating = 'mature' into mature from public.prompts p where p.id = new.prompt_id;
  mature := coalesce(mature, false) or 'mature-content' = any(new.moderation_labels);
  if tg_op = 'UPDATE' then
    -- A later rating downgrade or cleared moderation list cannot silently make
    -- an adult recording public. Releasing this launch hold needs explicit review.
    mature := mature or 'mature-content' = any(old.moderation_labels);
  end if;
  if mature then
    new.moderation_labels := array_append(array_remove(new.moderation_labels, 'mature-content'), 'mature-content');
    if new.visibility <> 'private' or new.share_asset_path is not null then
      raise exception using errcode = '42501', message = 'Mature recordings must stay private until an age and audience publication policy is approved';
    end if;
  end if;
  return new;
end;
$$;

create trigger deliveries_enforce_mature_private
  before insert or update of visibility, prompt_id, moderation_labels, share_asset_path
  on public.deliveries for each row execute function public.enforce_mature_delivery_private();
revoke all on function public.enforce_mature_delivery_private() from public, anon, authenticated;

-- Rating escalation must also close existing distribution. Refuse to discard
-- share-object pointers until actual Storage cleanup has happened.
create or replace function public.contain_newly_mature_prompt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare affected_user uuid;
begin
  if new.rating = 'mature' and old.rating is distinct from 'mature'::public.content_rating then
    if exists (select 1 from public.deliveries d where d.prompt_id = new.id and d.share_asset_path is not null) then
      raise exception using errcode = '55000', message = 'Remove delivery-share objects through the Storage API before changing this prompt to mature';
    end if;
    update public.deliveries d
    set visibility = 'private', published_at = null,
        moderation_labels = array_append(array_remove(d.moderation_labels, 'mature-content'), 'mature-content')
    where d.prompt_id = new.id;
    for affected_user in select distinct d.user_id from public.deliveries d where d.prompt_id = new.id loop
      perform public.refresh_user_rollups(affected_user);
    end loop;
  end if;
  return new;
end;
$$;
create trigger prompts_contain_newly_mature
  before update of rating on public.prompts
  for each row execute function public.contain_newly_mature_prompt();
revoke all on function public.contain_newly_mature_prompt() from public, anon, authenticated;

comment on function public.enforce_mature_delivery_private() is
  'Launch hold: canonical mature content and sticky mature receipts cannot be public, unlisted or attached to public share assets, regardless of moderation approval.';
