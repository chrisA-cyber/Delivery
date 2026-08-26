-- Complete signed challenge links remain useful as matchup receipts, and the
-- first non-creator entrant becomes the stable recipient for participant RLS.

create or replace function public.get_challenge_by_invite(p_code text, p_token text)
returns table (
  id uuid,
  code text,
  created_by uuid,
  challenger_handle text,
  challenger_name text,
  challenger_avatar_path text,
  recipient_user_id uuid,
  prompt_id uuid,
  energy_modifier_id uuid,
  state public.challenge_state,
  visibility public.challenge_visibility,
  message text,
  max_entries smallint,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.code::text,
    c.created_by,
    p.handle::text,
    p.display_name,
    p.avatar_path,
    c.recipient_user_id,
    c.prompt_id,
    c.energy_modifier_id,
    c.state,
    c.visibility,
    c.message,
    c.max_entries,
    c.expires_at,
    c.created_at
  from public.challenges c
  join public.profiles p on p.id = c.created_by
  where lower(c.code::text) = lower(p_code)
    and c.token_digest is not null
    and c.token_digest = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
    and c.state in ('open', 'accepted', 'completed')
    and c.expires_at > now()
  limit 1;
$$;

create or replace function public.validate_challenge_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.challenges;
  delivery_owner uuid;
  delivery_challenge uuid;
  delivery_status public.delivery_state;
  entry_count integer;
begin
  select * into target from public.challenges where id = new.challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if target.state not in ('open', 'accepted') or target.expires_at <= now() then
    raise exception 'Challenge is no longer accepting entries';
  end if;

  select user_id, challenge_id, state
  into delivery_owner, delivery_challenge, delivery_status
  from public.deliveries where id = new.delivery_id;
  if delivery_owner is distinct from new.entrant_id
     or delivery_challenge is distinct from new.challenge_id then
    raise exception 'Delivery does not belong to this entrant and challenge';
  end if;
  if delivery_status is distinct from 'judged'
     or not exists (select 1 from public.delivery_scores s where s.delivery_id = new.delivery_id) then
    raise exception 'Only judged deliveries can enter a challenge';
  end if;

  select count(*) into entry_count from public.challenge_entries where challenge_id = new.challenge_id;
  if entry_count >= target.max_entries then raise exception 'Challenge entry limit reached'; end if;

  -- The challenge row lock makes first-rival binding atomic. The creator never
  -- occupies recipient_user_id, regardless of which participant submits first.
  if new.entrant_id <> target.created_by then
    if target.recipient_user_id is null then
      update public.challenges
      set recipient_user_id = new.entrant_id, updated_at = now()
      where id = target.id and recipient_user_id is null;
      target.recipient_user_id := new.entrant_id;
    elsif target.recipient_user_id <> new.entrant_id then
      raise exception 'Entrant is not invited to this challenge';
    end if;
  end if;

  if target.recipient_user_id is not null
     and new.entrant_id not in (target.created_by, target.recipient_user_id) then
    raise exception 'Entrant is not invited to this challenge';
  end if;
  return new;
end;
$$;

-- The participant trigger owns post-creation recipient binding. A signed-in
-- creator may still set an intended recipient at INSERT time, but cannot swap the
-- rival after an invite has started collecting entries.
revoke update (recipient_user_id) on public.challenges from authenticated;

revoke all on function public.get_challenge_by_invite(text, text) from public, anon, authenticated;
grant execute on function public.get_challenge_by_invite(text, text) to anon, authenticated;
revoke all on function public.validate_challenge_entry() from public, anon, authenticated;

comment on function public.get_challenge_by_invite(text, text) is 'Signed invite lookup for active or completed, unexpired matchup receipts; returns no digest.';
comment on function public.validate_challenge_entry() is 'Serializes judged challenge admission and atomically binds the first non-creator entrant as the immutable recipient.';
