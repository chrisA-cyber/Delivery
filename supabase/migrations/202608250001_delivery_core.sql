-- Delivery core schema
-- Designed for Supabase Postgres 15+. Run with `supabase db reset` locally.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.app_role as enum ('user', 'moderator', 'admin');
create type public.content_state as enum ('draft', 'review', 'published', 'rejected', 'archived');
create type public.content_rating as enum ('everyone', 'teen');
create type public.pack_access as enum ('free', 'pro', 'rotating');
create type public.prompt_source as enum ('built_in', 'editorial', 'trend', 'user');
create type public.delivery_state as enum ('uploading', 'processing', 'judged', 'failed', 'removed');
create type public.delivery_visibility as enum ('public', 'unlisted', 'private');
create type public.challenge_state as enum ('open', 'accepted', 'completed', 'expired', 'canceled');
create type public.challenge_visibility as enum ('link', 'public', 'private');
create type public.reaction_kind as enum ('fire', 'crying', 'skull', 'aura', 'committed');
create type public.report_reason as enum ('harassment', 'hate', 'sexual', 'violence', 'self_harm', 'spam', 'privacy', 'copyright', 'other');
create type public.report_state as enum ('open', 'triaged', 'actioned', 'dismissed');
create type public.moderation_decision as enum ('allow', 'limit', 'remove', 'suspend', 'ban');
create type public.plan_tier as enum ('free', 'pro');
create type public.subscription_state as enum ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete', 'incomplete_expired');
create type public.stream_state as enum ('lobby', 'live', 'ended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle extensions.citext not null unique,
  display_name text not null default 'New player',
  avatar_path text,
  bio text,
  role public.app_role not null default 'user',
  is_private boolean not null default false,
  is_verified boolean not null default false,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle::text ~ '^[a-zA-Z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 48),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 240)
);

create table public.profile_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  timezone text not null default 'UTC',
  autoplay boolean not null default false,
  captions boolean not null default true,
  reduced_motion boolean not null default false,
  email_challenges boolean not null default true,
  email_product_updates boolean not null default false,
  default_delivery_visibility public.delivery_visibility not null default 'private',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_preferences_timezone_length check (char_length(timezone) between 1 and 64),
  constraint profile_preferences_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.content_packs (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null unique,
  name text not null,
  eyebrow text,
  description text not null,
  access public.pack_access not null default 'free',
  state public.content_state not null default 'draft',
  categories text[] not null default '{}',
  tags text[] not null default '{}',
  color text,
  accent text,
  icon text,
  cover_tone text,
  cover_image_path text,
  sort_order integer not null default 0,
  featured boolean not null default false,
  available_from timestamptz,
  available_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_packs_slug_format check (slug::text ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint content_packs_window check (available_until is null or available_from is null or available_until > available_from)
);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null unique,
  body text not null,
  locale text not null default 'en',
  category text not null,
  difficulty smallint not null default 2,
  rating public.content_rating not null default 'everyone',
  state public.content_state not null default 'draft',
  source public.prompt_source not null default 'built_in',
  submitted_by uuid references public.profiles(id) on delete set null,
  source_label text,
  is_mimic boolean not null default false,
  tags text[] not null default '{}',
  safety_labels text[] not null default '{}',
  scoring_focus text[] not null default array['commitment', 'comedy'],
  metadata jsonb not null default '{}'::jsonb,
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(body, ''))
  ) stored,
  constraint prompts_slug_format check (slug::text ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  constraint prompts_locale_body_unique unique (locale, body),
  constraint prompts_body_length check (char_length(btrim(body)) between 3 and 180),
  constraint prompts_difficulty_range check (difficulty between 1 and 4),
  constraint prompts_scoring_focus check (scoring_focus <@ array['commitment', 'comedy', 'accuracy', 'chaos']::text[]),
  constraint prompts_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint prompts_window check (available_until is null or available_from is null or available_until > available_from)
);

create table public.energy_modifiers (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null unique,
  instruction text not null,
  short_label text not null,
  intensity smallint not null,
  tags text[] not null default '{}',
  compatible_difficulties smallint[],
  state public.content_state not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint energy_modifiers_instruction_unique unique (instruction),
  constraint energy_modifiers_slug_format check (slug::text ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
  constraint energy_modifiers_instruction_length check (char_length(instruction) between 8 and 220),
  constraint energy_modifiers_label_length check (char_length(short_label) between 2 and 48),
  constraint energy_modifiers_intensity_range check (intensity between 1 and 5),
  constraint energy_modifiers_difficulty_values check (compatible_difficulties is null or compatible_difficulties <@ array[1,2,3,4]::smallint[]),
  constraint energy_modifiers_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.pack_prompts (
  pack_id uuid not null references public.content_packs(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  sort_order integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (pack_id, prompt_id)
);

create table public.trend_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug extensions.citext not null unique,
  label text not null,
  editorial_note text,
  markets text[] not null default array['global'],
  priority integer not null default 10,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state public.content_state not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trend_campaigns_window check (ends_at > starts_at),
  constraint trend_campaigns_priority check (priority between 0 and 1000)
);

create table public.trend_prompts (
  campaign_id uuid not null references public.trend_campaigns(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  energy_modifier_id uuid references public.energy_modifiers(id) on delete set null,
  sort_order integer not null default 0,
  weight integer not null default 1,
  primary key (campaign_id, prompt_id),
  constraint trend_prompts_weight check (weight between 1 and 100)
);

create table public.daily_challenges (
  challenge_date date not null,
  market text not null default 'global',
  prompt_id uuid not null references public.prompts(id) on delete restrict,
  energy_modifier_id uuid not null references public.energy_modifiers(id) on delete restrict,
  title text,
  sponsor_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (challenge_date, market),
  unique (challenge_date, market, prompt_id),
  constraint daily_challenges_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique,
  token_digest bytea,
  created_by uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  prompt_id uuid not null references public.prompts(id) on delete restrict,
  energy_modifier_id uuid references public.energy_modifiers(id) on delete set null,
  state public.challenge_state not null default 'open',
  visibility public.challenge_visibility not null default 'link',
  message text,
  max_entries smallint not null default 2,
  expires_at timestamptz not null default (now() + interval '7 days'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_code_format check (code::text ~ '^[A-Za-z0-9]{6,20}$'),
  constraint challenges_message_length check (message is null or char_length(message) <= 180),
  constraint challenges_max_entries check (max_entries between 1 and 20)
);

create table public.stream_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  code extensions.citext not null unique,
  state public.stream_state not null default 'lobby',
  title text not null default 'Delivery Stream',
  current_prompt_id uuid references public.prompts(id) on delete set null,
  current_energy_modifier_id uuid references public.energy_modifiers(id) on delete set null,
  allow_audience_votes boolean not null default true,
  settings jsonb not null default '{"hideScoresUntilReveal":true,"voteWindowSeconds":20}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stream_sessions_code_format check (code::text ~ '^[A-Za-z0-9]{5,16}$'),
  constraint stream_sessions_title_length check (char_length(title) between 1 and 80),
  constraint stream_sessions_settings_object check (jsonb_typeof(settings) = 'object')
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete restrict,
  energy_modifier_id uuid references public.energy_modifiers(id) on delete set null,
  challenge_id uuid references public.challenges(id) on delete set null,
  stream_session_id uuid references public.stream_sessions(id) on delete set null,
  daily_challenge_date date,
  daily_challenge_market text,
  state public.delivery_state not null default 'uploading',
  visibility public.delivery_visibility not null default 'private',
  recording_path text,
  share_asset_path text,
  mime_type text,
  duration_ms integer,
  byte_size bigint,
  waveform jsonb,
  transcript text,
  transcript_confidence numeric(5,4),
  take_count smallint not null default 1,
  failure_code text,
  moderation_labels text[] not null default '{}',
  published_at timestamptz,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliveries_duration check (duration_ms is null or duration_ms between 250 and 120000),
  constraint deliveries_byte_size check (byte_size is null or byte_size between 1 and 52428800),
  constraint deliveries_take_count check (take_count between 1 and 20),
  constraint deliveries_waveform_array check (waveform is null or jsonb_typeof(waveform) = 'array'),
  constraint deliveries_transcript_length check (transcript is null or char_length(transcript) <= 2000),
  constraint deliveries_transcript_confidence check (transcript_confidence is null or transcript_confidence between 0 and 1),
  constraint deliveries_daily_pair check (
    (daily_challenge_date is null and daily_challenge_market is null)
    or (daily_challenge_date is not null and daily_challenge_market is not null)
  ),
  constraint deliveries_daily_fk foreign key (daily_challenge_date, daily_challenge_market, prompt_id)
    references public.daily_challenges(challenge_date, market, prompt_id) deferrable initially deferred
);

create table public.delivery_scores (
  delivery_id uuid primary key references public.deliveries(id) on delete cascade,
  overall smallint not null,
  commitment smallint not null,
  comedy smallint not null,
  accuracy smallint,
  chaos smallint not null,
  confidence numeric(5,4),
  headline text not null,
  verdict text not null,
  highlight_moment_ms integer,
  rubric_version text not null,
  provider text not null,
  model text not null,
  evidence jsonb not null default '{}'::jsonb,
  safety jsonb not null default '{}'::jsonb,
  latency_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_scores_overall check (overall between 0 and 100),
  constraint delivery_scores_commitment check (commitment between 0 and 100),
  constraint delivery_scores_comedy check (comedy between 0 and 100),
  constraint delivery_scores_accuracy check (accuracy is null or accuracy between 0 and 100),
  constraint delivery_scores_chaos check (chaos between 0 and 100),
  constraint delivery_scores_confidence check (confidence is null or confidence between 0 and 1),
  constraint delivery_scores_headline_length check (char_length(headline) between 1 and 80),
  constraint delivery_scores_verdict_length check (char_length(verdict) between 1 and 500),
  constraint delivery_scores_highlight check (highlight_moment_ms is null or highlight_moment_ms >= 0),
  constraint delivery_scores_latency check (latency_ms is null or latency_ms >= 0),
  constraint delivery_scores_evidence_object check (jsonb_typeof(evidence) = 'object'),
  constraint delivery_scores_safety_object check (jsonb_typeof(safety) = 'object')
);

create table public.challenge_entries (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  delivery_id uuid not null unique references public.deliveries(id) on delete cascade,
  entrant_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (challenge_id, entrant_id)
);

create table public.reactions (
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.reaction_kind not null,
  created_at timestamptz not null default now(),
  primary key (delivery_id, user_id)
);

create table public.prompt_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create table public.stream_votes (
  stream_session_id uuid not null references public.stream_sessions(id) on delete cascade,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  score smallint not null,
  created_at timestamptz not null default now(),
  primary key (stream_session_id, delivery_id, voter_id),
  constraint stream_votes_score check (score between 1 and 10)
);

create table public.line_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  proposed_body text not null,
  proposed_category text,
  proposed_tags text[] not null default '{}',
  suggested_energy text,
  state public.content_state not null default 'review',
  automated_labels text[] not null default '{}',
  automated_scores jsonb not null default '{}'::jsonb,
  reviewer_note text,
  promoted_prompt_id uuid references public.prompts(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint line_submissions_body_length check (char_length(btrim(proposed_body)) between 3 and 180),
  constraint line_submissions_energy_length check (suggested_energy is null or char_length(suggested_energy) <= 220),
  constraint line_submissions_scores_object check (jsonb_typeof(automated_scores) = 'object')
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  prompt_id uuid references public.prompts(id) on delete cascade,
  submission_id uuid references public.line_submissions(id) on delete cascade,
  reason public.report_reason not null,
  details text,
  state public.report_state not null default 'open',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_one_target check (
    num_nonnulls(delivery_id, profile_id, prompt_id, submission_id) = 1
  ),
  constraint reports_details_length check (details is null or char_length(details) <= 1000)
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  subject_user_id uuid references public.profiles(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete cascade,
  prompt_id uuid references public.prompts(id) on delete cascade,
  submission_id uuid references public.line_submissions(id) on delete cascade,
  decision public.moderation_decision not null,
  reason text not null,
  internal_note text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint moderation_actions_target check (
    num_nonnulls(subject_user_id, delivery_id, prompt_id, submission_id) >= 1
  )
);

create table public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_id uuid references public.moderation_actions(id) on delete set null,
  kind text not null,
  reason text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_restrictions_window check (ends_at is null or ends_at > starts_at)
);

create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier public.plan_tier not null default 'free',
  state public.subscription_state not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.usage_counters (
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  plays integer not null default 0,
  ai_scores integer not null default 0,
  share_renders integer not null default 0,
  custom_challenges integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start),
  constraint usage_counters_nonnegative check (plays >= 0 and ai_scores >= 0 and share_renders >= 0 and custom_challenges >= 0)
);

create table public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  color text not null,
  rarity text not null default 'common',
  rule jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint badges_id_format check (id ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  constraint badges_rule_object check (jsonb_typeof(rule) = 'object')
);

create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  awarded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, badge_id)
);

create table public.user_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  judged_deliveries integer not null default 0,
  public_deliveries integer not null default 0,
  score_sum bigint not null default 0,
  average_score numeric(6,2) not null default 0,
  best_score smallint not null default 0,
  average_commitment numeric(6,2) not null default 0,
  average_comedy numeric(6,2) not null default 0,
  average_accuracy numeric(6,2),
  average_chaos numeric(6,2) not null default 0,
  best_delivery_id uuid references public.deliveries(id) on delete set null,
  current_daily_streak integer not null default 0,
  longest_daily_streak integer not null default 0,
  last_daily_date date,
  reactions_received bigint not null default 0,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.user_category_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  judged_deliveries integer not null default 0,
  average_score numeric(6,2) not null default 0,
  best_score smallint not null default 0,
  average_commitment numeric(6,2) not null default 0,
  average_comedy numeric(6,2) not null default 0,
  average_accuracy numeric(6,2),
  average_chaos numeric(6,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

create table public.prompt_stats (
  prompt_id uuid primary key references public.prompts(id) on delete cascade,
  plays bigint not null default 0,
  judged_deliveries bigint not null default 0,
  average_score numeric(6,2) not null default 0,
  shares bigint not null default 0,
  favorites bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.leaderboard_snapshots (
  period text not null,
  metric text not null,
  period_start timestamptz not null,
  rank integer not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  score numeric(8,2) not null,
  generated_at timestamptz not null default now(),
  primary key (period, metric, period_start, rank),
  unique (period, metric, period_start, user_id),
  constraint leaderboard_period check (period in ('daily', 'weekly', 'all_time')),
  constraint leaderboard_metric check (metric in ('overall', 'commitment', 'comedy', 'chaos')),
  constraint leaderboard_rank check (rank > 0)
);

create index prompts_state_availability_idx on public.prompts (state, available_from, available_until);
create index prompts_category_rating_idx on public.prompts (category, rating, difficulty) where state = 'published';
create index prompts_tags_gin_idx on public.prompts using gin (tags);
create index prompts_search_gin_idx on public.prompts using gin (search_document);
create index content_packs_state_sort_idx on public.content_packs (state, sort_order);
create index pack_prompts_prompt_idx on public.pack_prompts (prompt_id, pack_id);
create index trend_campaigns_active_idx on public.trend_campaigns (state, starts_at, ends_at, priority desc);
create index daily_challenges_prompt_idx on public.daily_challenges (prompt_id, challenge_date desc);
create index challenges_creator_idx on public.challenges (created_by, created_at desc);
create index challenges_recipient_idx on public.challenges (recipient_user_id, state, created_at desc);
create index challenges_expiry_idx on public.challenges (state, expires_at) where state in ('open', 'accepted');
create index deliveries_user_created_idx on public.deliveries (user_id, created_at desc);
create index deliveries_public_feed_idx on public.deliveries (published_at desc, id) where visibility = 'public' and state = 'judged';
create index deliveries_prompt_idx on public.deliveries (prompt_id, created_at desc);
create index deliveries_daily_idx on public.deliveries (daily_challenge_date, created_at desc) where daily_challenge_date is not null;
create index deliveries_challenge_idx on public.deliveries (challenge_id) where challenge_id is not null;
create index delivery_scores_overall_idx on public.delivery_scores (overall desc, created_at desc);
create index delivery_scores_chaos_idx on public.delivery_scores (chaos desc, created_at desc);
create index delivery_scores_commitment_idx on public.delivery_scores (commitment desc, created_at desc);
create index reactions_delivery_created_idx on public.reactions (delivery_id, created_at desc);
create index follows_following_idx on public.follows (following_id, created_at desc);
create index blocks_blocked_idx on public.blocks (blocked_id, created_at desc);
create index reports_queue_idx on public.reports (state, created_at) where state in ('open', 'triaged');
create index moderation_actions_subject_idx on public.moderation_actions (subject_user_id, created_at desc) where subject_user_id is not null;
create index account_restrictions_active_idx on public.account_restrictions (user_id, starts_at, ends_at);
create index line_submissions_queue_idx on public.line_submissions (state, created_at) where state = 'review';
create index stream_sessions_discover_idx on public.stream_sessions (state, created_at desc) where state in ('lobby', 'live');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger profile_preferences_set_updated_at before update on public.profile_preferences for each row execute function public.set_updated_at();
create trigger content_packs_set_updated_at before update on public.content_packs for each row execute function public.set_updated_at();
create trigger prompts_set_updated_at before update on public.prompts for each row execute function public.set_updated_at();
create trigger energy_modifiers_set_updated_at before update on public.energy_modifiers for each row execute function public.set_updated_at();
create trigger trend_campaigns_set_updated_at before update on public.trend_campaigns for each row execute function public.set_updated_at();
create trigger challenges_set_updated_at before update on public.challenges for each row execute function public.set_updated_at();
create trigger stream_sessions_set_updated_at before update on public.stream_sessions for each row execute function public.set_updated_at();
create trigger deliveries_set_updated_at before update on public.deliveries for each row execute function public.set_updated_at();
create trigger delivery_scores_set_updated_at before update on public.delivery_scores for each row execute function public.set_updated_at();
create trigger line_submissions_set_updated_at before update on public.line_submissions for each row execute function public.set_updated_at();
create trigger reports_set_updated_at before update on public.reports for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger usage_counters_set_updated_at before update on public.usage_counters for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_handle text;
  requested_name text;
begin
  requested_handle := regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'preferred_username', ''),
    '[^a-zA-Z0-9_]', '', 'g'
  );
  if char_length(requested_handle) < 3 then
    requested_handle := 'player_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;
  requested_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '');

  insert into public.profiles (id, handle, display_name, avatar_path)
  values (
    new.id,
    left(requested_handle, 24),
    left(coalesce(requested_name, requested_handle), 48),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id) values (new.id) on conflict do nothing;
  insert into public.user_stats (user_id) values (new.id) on conflict do nothing;
  insert into public.profile_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
exception
  when unique_violation then
    insert into public.profiles (id, handle, display_name, avatar_path)
    values (
      new.id,
      'player_' || substr(replace(new.id::text, '-', ''), 1, 12),
      left(coalesce(requested_name, 'New player'), 48),
      new.raw_user_meta_data ->> 'avatar_url'
    ) on conflict (id) do nothing;
    insert into public.subscriptions (user_id) values (new.id) on conflict do nothing;
    insert into public.user_stats (user_id) values (new.id) on conflict do nothing;
    insert into public.profile_preferences (user_id) values (new.id) on conflict do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Safe backfill when the product schema is introduced after Auth already has users.
insert into public.profiles (id, handle, display_name, avatar_path, created_at)
select
  u.id,
  'player_' || substr(replace(u.id::text, '-', ''), 1, 12),
  left(coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), 'New player'), 48),
  u.raw_user_meta_data ->> 'avatar_url',
  coalesce(u.created_at, now())
from auth.users u
on conflict (id) do nothing;

insert into public.subscriptions (user_id)
select id from public.profiles on conflict (user_id) do nothing;
insert into public.user_stats (user_id)
select id from public.profiles on conflict (user_id) do nothing;
insert into public.profile_preferences (user_id)
select id from public.profiles on conflict (user_id) do nothing;

create or replace function public.mark_delivery_judged()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.deliveries
  set state = 'judged', scored_at = coalesce(scored_at, now()), published_at = case
    when visibility = 'public' then coalesce(published_at, now())
    else published_at
  end
  where id = new.delivery_id and state <> 'removed';
  return new;
end;
$$;

create trigger delivery_score_marks_judged
  after insert or update on public.delivery_scores
  for each row execute function public.mark_delivery_judged();

create or replace function public.refresh_user_rollups(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_stats (
    user_id, judged_deliveries, public_deliveries, score_sum, average_score,
    best_score, average_commitment, average_comedy, average_accuracy,
    average_chaos, best_delivery_id, reactions_received, updated_at
  )
  select
    p_user_id,
    count(s.delivery_id)::integer,
    count(s.delivery_id) filter (where d.visibility = 'public' and d.state = 'judged')::integer,
    coalesce(sum(s.overall), 0)::bigint,
    coalesce(round(avg(s.overall), 2), 0),
    coalesce(max(s.overall), 0)::smallint,
    coalesce(round(avg(s.commitment), 2), 0),
    coalesce(round(avg(s.comedy), 2), 0),
    round(avg(s.accuracy), 2),
    coalesce(round(avg(s.chaos), 2), 0),
    (array_agg(d.id order by s.overall desc, d.created_at asc) filter (where s.delivery_id is not null))[1],
    (select count(*) from public.reactions r join public.deliveries rd on rd.id = r.delivery_id where rd.user_id = p_user_id),
    now()
  from public.deliveries d
  left join public.delivery_scores s on s.delivery_id = d.id
  where d.user_id = p_user_id and d.state <> 'removed'
  on conflict (user_id) do update set
    judged_deliveries = excluded.judged_deliveries,
    public_deliveries = excluded.public_deliveries,
    score_sum = excluded.score_sum,
    average_score = excluded.average_score,
    best_score = excluded.best_score,
    average_commitment = excluded.average_commitment,
    average_comedy = excluded.average_comedy,
    average_accuracy = excluded.average_accuracy,
    average_chaos = excluded.average_chaos,
    best_delivery_id = excluded.best_delivery_id,
    reactions_received = excluded.reactions_received,
    updated_at = now();

  delete from public.user_category_stats where user_id = p_user_id;
  insert into public.user_category_stats (
    user_id, category, judged_deliveries, average_score, best_score,
    average_commitment, average_comedy, average_accuracy, average_chaos, updated_at
  )
  select
    p_user_id,
    p.category,
    count(*)::integer,
    round(avg(s.overall), 2),
    max(s.overall)::smallint,
    round(avg(s.commitment), 2),
    round(avg(s.comedy), 2),
    round(avg(s.accuracy), 2),
    round(avg(s.chaos), 2),
    now()
  from public.deliveries d
  join public.delivery_scores s on s.delivery_id = d.id
  join public.prompts p on p.id = d.prompt_id
  where d.user_id = p_user_id and d.state = 'judged'
  group by p.category;
end;
$$;

create or replace function public.refresh_rollups_from_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_delivery uuid;
  affected_user uuid;
begin
  if tg_op = 'DELETE' then affected_delivery := old.delivery_id; else affected_delivery := new.delivery_id; end if;
  select user_id into affected_user from public.deliveries where id = affected_delivery;
  if affected_user is not null then perform public.refresh_user_rollups(affected_user); end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger delivery_scores_refresh_rollups
  after insert or update or delete on public.delivery_scores
  for each row execute function public.refresh_rollups_from_score();

create or replace function public.refresh_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_follower uuid;
  affected_following uuid;
begin
  if tg_op = 'DELETE' then
    affected_follower := old.follower_id;
    affected_following := old.following_id;
  else
    affected_follower := new.follower_id;
    affected_following := new.following_id;
  end if;
  update public.user_stats
  set following_count = (select count(*) from public.follows where follower_id = affected_follower), updated_at = now()
  where user_id = affected_follower;
  update public.user_stats
  set followers_count = (select count(*) from public.follows where following_id = affected_following), updated_at = now()
  where user_id = affected_following;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger follows_refresh_counts
  after insert or delete on public.follows
  for each row execute function public.refresh_follow_counts();

create or replace function public.remove_follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

create trigger blocks_remove_follows
  after insert on public.blocks
  for each row execute function public.remove_follows_on_block();

create or replace function public.refresh_reaction_rollup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_delivery uuid;
  affected_user uuid;
begin
  if tg_op = 'DELETE' then affected_delivery := old.delivery_id; else affected_delivery := new.delivery_id; end if;
  select user_id into affected_user from public.deliveries where id = affected_delivery;
  if affected_user is not null then perform public.refresh_user_rollups(affected_user); end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger reactions_refresh_rollup
  after insert or update or delete on public.reactions
  for each row execute function public.refresh_reaction_rollup();

create or replace function public.refresh_prompt_stats(p_prompt_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.prompt_stats (prompt_id, plays, judged_deliveries, average_score, favorites, updated_at)
  select
    p_prompt_id,
    count(distinct d.id),
    count(distinct s.delivery_id),
    coalesce(round(avg(s.overall), 2), 0),
    (select count(*) from public.prompt_favorites f where f.prompt_id = p_prompt_id),
    now()
  from public.prompts p
  left join public.deliveries d on d.prompt_id = p.id and d.state <> 'removed'
  left join public.delivery_scores s on s.delivery_id = d.id
  where p.id = p_prompt_id
  group by p.id
  on conflict (prompt_id) do update set
    plays = excluded.plays,
    judged_deliveries = excluded.judged_deliveries,
    average_score = excluded.average_score,
    favorites = excluded.favorites,
    updated_at = now();
$$;

create or replace function public.refresh_prompt_stats_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_prompt uuid;
begin
  if tg_table_name = 'prompt_favorites' then
    if tg_op = 'DELETE' then affected_prompt := old.prompt_id; else affected_prompt := new.prompt_id; end if;
  else
    if tg_op = 'DELETE' then
      select prompt_id into affected_prompt from public.deliveries where id = old.delivery_id;
    else
      select prompt_id into affected_prompt from public.deliveries where id = new.delivery_id;
    end if;
  end if;
  if affected_prompt is not null then perform public.refresh_prompt_stats(affected_prompt); end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger prompt_favorites_refresh_stats
  after insert or delete on public.prompt_favorites
  for each row execute function public.refresh_prompt_stats_trigger();
create trigger delivery_scores_refresh_prompt_stats
  after insert or update or delete on public.delivery_scores
  for each row execute function public.refresh_prompt_stats_trigger();

create or replace function public.refresh_rollups_after_delivery_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_user_rollups(old.user_id);
  perform public.refresh_prompt_stats(old.prompt_id);
  return old;
end;
$$;

create trigger deliveries_refresh_after_delete
  after delete on public.deliveries
  for each row execute function public.refresh_rollups_after_delivery_delete();

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
  entry_count integer;
begin
  select * into target from public.challenges where id = new.challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if target.state not in ('open', 'accepted') or target.expires_at <= now() then
    raise exception 'Challenge is no longer accepting entries';
  end if;
  if target.recipient_user_id is not null
     and new.entrant_id not in (target.created_by, target.recipient_user_id) then
    raise exception 'Entrant is not invited to this challenge';
  end if;
  select user_id, challenge_id into delivery_owner, delivery_challenge
  from public.deliveries where id = new.delivery_id;
  if delivery_owner is distinct from new.entrant_id
     or delivery_challenge is distinct from new.challenge_id then
    raise exception 'Delivery does not belong to this entrant and challenge';
  end if;
  select count(*) into entry_count from public.challenge_entries where challenge_id = new.challenge_id;
  if entry_count >= target.max_entries then raise exception 'Challenge entry limit reached'; end if;
  return new;
end;
$$;

create or replace function public.advance_challenge_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_max smallint;
  entry_count integer;
begin
  select max_entries into target_max from public.challenges where id = new.challenge_id for update;
  select count(*) into entry_count from public.challenge_entries where challenge_id = new.challenge_id;
  update public.challenges
  set
    state = case when entry_count >= target_max then 'completed'::public.challenge_state else 'accepted'::public.challenge_state end,
    completed_at = case when entry_count >= target_max then now() else null end
  where id = new.challenge_id;
  return new;
end;
$$;

create trigger challenge_entries_validate
  before insert on public.challenge_entries
  for each row execute function public.validate_challenge_entry();
create trigger challenge_entries_advance_state
  after insert on public.challenge_entries
  for each row execute function public.advance_challenge_state();

create or replace function public.ensure_daily_challenge(p_date date, p_market text default 'global')
returns public.daily_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_prompt uuid;
  selected_difficulty smallint;
  selected_energy uuid;
  result public.daily_challenges;
  normalized_market text := lower(coalesce(nullif(btrim(p_market), ''), 'global'));
  day_start timestamptz := (p_date::timestamp at time zone 'UTC');
begin
  if p_date is null then
    raise exception using errcode = '22023', message = 'A Daily challenge date is required';
  end if;

  select p.id, p.difficulty into selected_prompt, selected_difficulty
  from public.prompts p
  where p.state = 'published'
    and (p.available_from is null or p.available_from <= day_start)
    and (p.available_until is null or p.available_until > day_start)
    and exists (
      select 1
      from public.pack_prompts pp
      join public.content_packs pack on pack.id = pp.pack_id
      where pp.prompt_id = p.id
        and pack.state = 'published'
        and pack.access in ('free', 'rotating')
        and (pack.available_from is null or pack.available_from <= day_start)
        and (pack.available_until is null or pack.available_until > day_start)
    )
  order by md5(p_date::text || ':' || normalized_market || ':prompt:' || p.id::text)
  limit 1;

  select id into selected_energy
  from public.energy_modifiers
  where state = 'published'
    and (
      compatible_difficulties is null
      or selected_difficulty = any(compatible_difficulties)
    )
  order by md5(p_date::text || ':' || normalized_market || ':energy:' || id::text)
  limit 1;

  if selected_prompt is null or selected_energy is null then
    raise exception 'Published prompt and energy content must exist before generating a daily challenge';
  end if;

  insert into public.daily_challenges (challenge_date, market, prompt_id, energy_modifier_id)
  values (p_date, normalized_market, selected_prompt, selected_energy)
  on conflict (challenge_date, market) do nothing;

  select * into result from public.daily_challenges
  where challenge_date = p_date and market = normalized_market;
  return result;
end;
$$;

comment on table public.prompts is 'Canonical lines; editorial/trend/user sources share one moderation and availability pipeline.';
comment on table public.trend_campaigns is 'Time-boxed editorial injection layer. Do not hard-code current culture into application releases.';
comment on table public.delivery_scores is 'Structured AI judgment. Provider payloads should be redacted before storing in evidence.';
comment on column public.challenges.token_digest is 'SHA-256 digest only. Never persist raw invite secrets.';
comment on table public.leaderboard_snapshots is 'Optional cached top-N generated by a trusted scheduled worker; live leaderboard view is defined separately.';
