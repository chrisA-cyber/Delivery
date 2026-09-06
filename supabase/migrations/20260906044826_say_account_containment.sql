-- Reuse the same account mutation lock as Classic and account erasure. An
-- upload whose INSERT loses the race is removed by createSayAttempt's cleanup.
create trigger say_attempts_account_containment
before insert or update on public.say_attempts
for each row execute function public.reject_delivery_during_account_deletion();

create function public.guard_say_challenge_account() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('delivery-account-delete:' || new.created_by::text, 0)
  );
  if exists (select 1 from public.account_deletion_jobs j where j.user_id = new.created_by) then
    raise exception using errcode = '55000', message = 'Account deletion is already in progress';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_say_challenge_account() from public, anon, authenticated;
create trigger say_challenges_account_containment before insert on public.say_challenges
for each row execute function public.guard_say_challenge_account();
