-- Real reference media is public; player audio remains in private delivery-audio.
create table public.say_clip_versions (
  id text primary key,
  clip_id text not null,
  version text not null,
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clip_id, version),
  check (id = clip_id || ':' || version)
);

create table public.say_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_owner_hash text,
  owner_key text not null,
  attempt_key text not null,
  request_fingerprint text not null,
  clip_version_id text not null references public.say_clip_versions(id),
  clip_snapshot jsonb not null,
  role_id text not null,
  scoring_version text not null default 'say-match-v1',
  recording_path text not null unique,
  audio_mime text not null,
  audio_hash text not null,
  duration_ms integer not null check (duration_ms between 250 and 30000),
  recording_offset_ms integer not null default 0 check (recording_offset_ms between -300 and 300),
  status text not null default 'ready' check (status in ('ready','judging','scored','failed')),
  score jsonb,
  transcription jsonb,
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
  check ((user_id is not null and guest_owner_hash is null and expires_at is null) or (user_id is null and guest_owner_hash is not null and expires_at is not null)),
  check (status <> 'scored' or score is not null)
);
create index say_attempts_owner_history on public.say_attempts (user_id, created_at desc) where user_id is not null;
create index say_attempts_guest_expiry on public.say_attempts (expires_at) where user_id is null;
create index say_attempts_comparable on public.say_attempts (owner_key, clip_version_id, role_id, scoring_version, created_at desc);

create table public.say_challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null references public.say_attempts(id) on delete cascade,
  token_hash text not null unique,
  clip_version_id text not null references public.say_clip_versions(id),
  role_id text not null,
  scoring_version text not null,
  revoked_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
alter table public.say_attempts add constraint say_attempts_challenge_fk foreign key (challenge_id) references public.say_challenges(id) on delete set null;
create index say_attempts_challenge_entries on public.say_attempts (challenge_id, created_at desc) where challenge_id is not null;
create index say_challenges_creator on public.say_challenges (created_by, created_at desc);

alter table public.say_clip_versions enable row level security;
alter table public.say_attempts enable row level security;
alter table public.say_challenges enable row level security;
-- API performs age/content admission and capability checks. No anonymous direct
-- table access and no public recording links are introduced.
revoke all on public.say_clip_versions, public.say_attempts, public.say_challenges from anon, authenticated;
grant all on public.say_clip_versions, public.say_attempts, public.say_challenges to service_role;
-- Reads go through the authenticated application boundary, which checks the
-- deletion ledger before returning owner history or issuing any audio bytes.
-- Default-deny RLS also prevents contained sessions using PostgREST directly.

create function public.enforce_say_clip_immutability() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.clip_id <> old.clip_id or new.version <> old.version or new.manifest <> old.manifest then
    raise exception 'Published clip versions are immutable; import a new version';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_say_clip_immutability() from public, anon, authenticated;
create trigger say_clip_versions_immutable before update on public.say_clip_versions for each row execute function public.enforce_say_clip_immutability();

comment on table public.say_clip_versions is 'Curated source rights, media, roles, timed dialogue and exact source boundaries in immutable validated manifest.';
comment on table public.say_attempts is 'Private original capture plus immutable scene snapshot. Saved before scoring; shared only through explicitly created/entered challenge capability.';
