-- Switch records one immutable, private take. Existing ranked tables and
-- historical Classic/Say judgments are deliberately untouched.
create table public.switch_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_owner_hash text,
  owner_key text not null,
  attempt_key text not null,
  request_fingerprint text not null,
  challenge_version_id text not null,
  challenge_snapshot jsonb not null check (jsonb_typeof(challenge_snapshot) = 'object'),
  scoring_version text not null,
  recording_path text not null unique,
  audio_mime text not null check (audio_mime in ('audio/wav','audio/wave','audio/x-wav','audio/mpeg','audio/mp3')),
  audio_hash text not null,
  duration_ms integer not null check (duration_ms between 14000 and 22000),
  recording_offset_ms integer not null default 0 check (recording_offset_ms = 0),
  status text not null default 'ready' check (status in ('ready','judging','scored','failed')),
  score jsonb,
  judging_usage jsonb,
  judge_calls integer not null default 0 check (judge_calls between 0 and 3),
  judge_started_at timestamptz,
  failure_code text,
  moderation_state text not null default 'pending' check (moderation_state in ('pending','approved','rejected','review')),
  moderation_labels text[] not null default '{}',
  shared_with_challenge boolean not null default false,
  challenge_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_key, attempt_key),
  check ((user_id is not null and guest_owner_hash is null and expires_at is null and owner_key = 'user:' || user_id::text)
      or (user_id is null and guest_owner_hash ~ '^[a-f0-9]{64}$' and expires_at is not null and owner_key = 'guest:' || guest_owner_hash)),
  check (challenge_version_id = (challenge_snapshot->>'id') || ':' || (challenge_snapshot->>'version')),
  check (scoring_version = challenge_snapshot->>'scoringVersion'),
  check (jsonb_typeof(challenge_snapshot->'cues') = 'array' and jsonb_array_length(challenge_snapshot->'cues') between 4 and 6),
  check (challenge_snapshot ?& array['id','version','scoringVersion','rubricVersion','cues','duration','rating']),
  check (status <> 'scored' or (score is not null and score->>'version' = scoring_version
      and score->>'rubricVersion' = challenge_snapshot->>'rubricVersion'
      and score->>'beta' = 'true' and score->>'ranked' = 'false'))
);
create index switch_attempts_owner_history on public.switch_attempts (user_id, created_at desc) where user_id is not null;
create index switch_attempts_guest_expiry on public.switch_attempts (expires_at) where user_id is null;
create index switch_attempts_comparable on public.switch_attempts (owner_key, challenge_version_id, scoring_version, created_at desc);

create table public.switch_challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null references public.switch_attempts(id) on delete cascade,
  token_hash text not null unique,
  challenge_version_id text not null,
  challenge_snapshot jsonb not null,
  scoring_version text not null,
  revoked_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
alter table public.switch_attempts add constraint switch_attempts_challenge_fk foreign key (challenge_id) references public.switch_challenges(id) on delete set null;
create index switch_attempts_challenge_entries on public.switch_attempts (challenge_id, created_at desc) where challenge_id is not null;
create index switch_challenges_creator on public.switch_challenges (created_by, created_at desc);
create index switch_challenges_attempt on public.switch_challenges (attempt_id);

-- All reads and mutations use the application's authenticated/capability
-- boundary. Default-deny RLS protects guest receipts and contained accounts.
alter table public.switch_attempts enable row level security;
alter table public.switch_challenges enable row level security;
revoke all on public.switch_attempts, public.switch_challenges from public, anon, authenticated;
grant all on public.switch_attempts, public.switch_challenges to service_role;

create function public.enforce_switch_attempt_immutability() returns trigger
language plpgsql set search_path = '' as $$
begin
  if row(new.id, new.attempt_key, new.request_fingerprint, new.challenge_version_id, new.challenge_snapshot,
         new.scoring_version, new.audio_hash, new.audio_mime, new.duration_ms, new.recording_offset_ms, new.created_at)
     is distinct from
     row(old.id, old.attempt_key, old.request_fingerprint, old.challenge_version_id, old.challenge_snapshot,
         old.scoring_version, old.audio_hash, old.audio_mime, old.duration_ms, old.recording_offset_ms, old.created_at) then
    raise exception using errcode = '55000', message = 'SWITCH_ATTEMPT_IMMUTABLE';
  end if;
  if old.status = 'scored' and (new.status <> 'scored' or new.score is distinct from old.score) then
    raise exception using errcode = '55000', message = 'SWITCH_SCORE_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_switch_attempt_immutability() from public, anon, authenticated;
create trigger switch_attempts_immutable before update on public.switch_attempts
for each row execute function public.enforce_switch_attempt_immutability();
create trigger switch_attempts_account_containment before insert or update on public.switch_attempts
for each row execute function public.reject_delivery_during_account_deletion();

create function public.guard_switch_challenge() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if row(new.id, new.created_by, new.attempt_id, new.token_hash, new.challenge_version_id, new.challenge_snapshot, new.scoring_version, new.created_at)
       is distinct from
       row(old.id, old.created_by, old.attempt_id, old.token_hash, old.challenge_version_id, old.challenge_snapshot, old.scoring_version, old.created_at) then
      raise exception using errcode = '55000', message = 'SWITCH_CHALLENGE_IMMUTABLE';
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-account-delete:' || new.created_by::text, 0));
    if exists (select 1 from public.account_deletion_jobs j where j.user_id = new.created_by) then
      raise exception using errcode = '55000', message = 'Account deletion is already in progress';
    end if;
    if not exists (select 1 from public.switch_attempts a where a.id = new.attempt_id and a.user_id = new.created_by
        and a.status = 'scored' and a.moderation_state = 'approved'
        and a.challenge_version_id = new.challenge_version_id and a.challenge_snapshot = new.challenge_snapshot
        and a.scoring_version = new.scoring_version and a.challenge_snapshot->>'rating' in ('everyone','teen')) then
      raise exception using errcode = '55000', message = 'SWITCH_CHALLENGE_SOURCE_INVALID';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_switch_challenge() from public, anon, authenticated;
create trigger switch_challenges_guard before insert or update on public.switch_challenges
for each row execute function public.guard_switch_challenge();

comment on table public.switch_attempts is 'Private uninterrupted Switch audio, immutable challenge/cue timeline and separate unranked beta rubric. Guest sources expire using the existing cleanup worker.';
comment on table public.switch_challenges is 'Direct friend capability: only the opted-in creator take is visible to every token holder. Recipient audio is available to its owner and the creator only.';
