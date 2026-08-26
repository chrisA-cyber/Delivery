-- RLS, safe public views, invite access, and private storage boundaries.

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('moderator', 'admin')
  );
$$;

create or replace function public.is_pro(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = p_user_id
      and tier = 'pro'
      and state in ('trialing', 'active')
      and (current_period_end is null or current_period_end > now())
  );
$$;

create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and (
        p.id = (select auth.uid())
        or public.is_staff()
        or (
          not exists (
            select 1 from public.blocks b
            where b.blocker_id = p.id and b.blocked_id = (select auth.uid())
          )
          and (
            not p.is_private
            or exists (
              select 1 from public.follows f
              where f.follower_id = (select auth.uid()) and f.following_id = p.id
            )
          )
        )
      )
  );
$$;

create or replace function public.can_view_delivery(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.deliveries d
    join public.profiles p on p.id = d.user_id
    where d.id = p_delivery_id
      and (
        d.user_id = (select auth.uid())
        or public.is_staff()
        or (
          d.state = 'judged'
          and (select auth.uid()) is not null
          and d.challenge_id is not null
          and not exists (
            select 1 from public.blocks b
            where b.blocker_id = d.user_id and b.blocked_id = (select auth.uid())
          )
          and exists (
            select 1 from public.challenges c
            where c.id = d.challenge_id
              and (c.created_by = (select auth.uid()) or c.recipient_user_id = (select auth.uid()))
          )
        )
        or (
          d.state = 'judged'
          and (select auth.uid()) is not null
          and d.stream_session_id is not null
          and not exists (
            select 1 from public.blocks b
            where b.blocker_id = d.user_id and b.blocked_id = (select auth.uid())
          )
          and exists (
            select 1 from public.stream_sessions ss
            where ss.id = d.stream_session_id and ss.host_id = (select auth.uid())
          )
        )
        or (
          d.state = 'judged'
          and d.visibility = 'public'
          and not exists (
            select 1 from public.blocks b
            where b.blocker_id = d.user_id and b.blocked_id = (select auth.uid())
          )
          and (
            not p.is_private
            or exists (
              select 1 from public.follows f
              where f.follower_id = (select auth.uid()) and f.following_id = p.id
            )
          )
        )
      )
  );
$$;

create or replace function public.has_active_restriction(p_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_restrictions
    where user_id = p_user_id
      and kind = p_kind
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
  );
$$;

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
    and c.state in ('open', 'accepted')
    and c.expires_at > now()
  limit 1;
$$;

alter table public.profiles enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.content_packs enable row level security;
alter table public.prompts enable row level security;
alter table public.energy_modifiers enable row level security;
alter table public.pack_prompts enable row level security;
alter table public.trend_campaigns enable row level security;
alter table public.trend_prompts enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.challenges enable row level security;
alter table public.stream_sessions enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_scores enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.reactions enable row level security;
alter table public.prompt_favorites enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.stream_votes enable row level security;
alter table public.line_submissions enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.account_restrictions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.user_stats enable row level security;
alter table public.user_category_stats enable row level security;
alter table public.prompt_stats enable row level security;
alter table public.leaderboard_snapshots enable row level security;

create policy "profiles visible by privacy graph" on public.profiles
  for select using (public.can_view_profile(id));
create policy "users update own profile" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "users read own preferences" on public.profile_preferences
  for select using (user_id = (select auth.uid()) or public.is_staff());
create policy "users update own preferences" on public.profile_preferences
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "published packs are readable" on public.content_packs
  for select using (
    public.is_staff() or (
      state = 'published'
      and (available_from is null or available_from <= now())
      and (available_until is null or available_until > now())
    )
  );
create policy "staff manage packs" on public.content_packs for all
  using (public.is_staff()) with check (public.is_staff());

create policy "published prompts are readable" on public.prompts
  for select using (
    public.is_staff() or submitted_by = (select auth.uid()) or (
      state = 'published'
      and (available_from is null or available_from <= now())
      and (available_until is null or available_until > now())
    )
  );
create policy "staff manage prompts" on public.prompts for all
  using (public.is_staff()) with check (public.is_staff());

create policy "published energy is readable" on public.energy_modifiers
  for select using (public.is_staff() or state = 'published');
create policy "staff manage energy" on public.energy_modifiers for all
  using (public.is_staff()) with check (public.is_staff());

create policy "published pack membership is readable" on public.pack_prompts
  for select using (
    public.is_staff() or (
      exists (select 1 from public.content_packs p where p.id = pack_id and p.state = 'published')
      and exists (select 1 from public.prompts p where p.id = prompt_id and p.state = 'published')
    )
  );
create policy "staff manage pack membership" on public.pack_prompts for all
  using (public.is_staff()) with check (public.is_staff());

create policy "active trends are readable" on public.trend_campaigns
  for select using (
    public.is_staff() or (state = 'published' and starts_at <= now() and ends_at > now())
  );
create policy "staff manage trends" on public.trend_campaigns for all
  using (public.is_staff()) with check (public.is_staff());
create policy "active trend prompts are readable" on public.trend_prompts
  for select using (
    public.is_staff() or exists (
      select 1 from public.trend_campaigns c
      where c.id = campaign_id and c.state = 'published' and c.starts_at <= now() and c.ends_at > now()
    )
  );
create policy "staff manage trend prompts" on public.trend_prompts for all
  using (public.is_staff()) with check (public.is_staff());

create policy "daily challenges are readable" on public.daily_challenges for select using (true);
create policy "staff manage daily challenges" on public.daily_challenges for all
  using (public.is_staff()) with check (public.is_staff());

create policy "challenge participants can read" on public.challenges
  for select using (
    created_by = (select auth.uid())
    or recipient_user_id = (select auth.uid())
    or visibility = 'public'
    or public.is_staff()
  );
create policy "users create challenges" on public.challenges
  for insert with check (
    created_by = (select auth.uid())
    and state = 'open'
    and completed_at is null
    and expires_at > now()
    and not public.has_active_restriction((select auth.uid()), 'challenge')
  );
create policy "creators update challenges" on public.challenges
  for update using (created_by = (select auth.uid()) or public.is_staff())
  with check (created_by = (select auth.uid()) or public.is_staff());
create policy "creators delete challenges" on public.challenges
  for delete using (created_by = (select auth.uid()) or public.is_staff());

create policy "visible stream sessions are readable" on public.stream_sessions
  for select using (host_id = (select auth.uid()) or state in ('lobby', 'live') or public.is_staff());
create policy "users host streams" on public.stream_sessions
  for insert with check (host_id = (select auth.uid()));
create policy "hosts update streams" on public.stream_sessions
  for update using (host_id = (select auth.uid()) or public.is_staff())
  with check (host_id = (select auth.uid()) or public.is_staff());
create policy "hosts delete streams" on public.stream_sessions
  for delete using (host_id = (select auth.uid()) or public.is_staff());

create policy "deliveries respect visibility" on public.deliveries
  for select using (public.can_view_delivery(id));
create policy "users create own deliveries" on public.deliveries
  for insert with check (
    user_id = (select auth.uid())
    and state in ('uploading', 'processing')
    and visibility = 'private'
    and not public.has_active_restriction((select auth.uid()), 'recording')
  );
create policy "users delete own deliveries" on public.deliveries
  for delete using (user_id = (select auth.uid()) or public.is_staff());

create policy "scores follow delivery visibility" on public.delivery_scores
  for select using (public.can_view_delivery(delivery_id));

create policy "challenge entries visible to participants" on public.challenge_entries
  for select using (
    entrant_id = (select auth.uid())
    or exists (
      select 1 from public.challenges c
      where c.id = challenge_id
        and (c.created_by = (select auth.uid()) or c.recipient_user_id = (select auth.uid()) or c.visibility = 'public')
    )
    or public.is_staff()
  );
create policy "users submit own challenge entry" on public.challenge_entries
  for insert with check (
    entrant_id = (select auth.uid())
    and exists (select 1 from public.deliveries d where d.id = delivery_id and d.user_id = (select auth.uid()) and d.challenge_id = challenge_id)
  );

create policy "reactions follow delivery visibility" on public.reactions
  for select using (public.can_view_delivery(delivery_id));
create policy "users react as themselves" on public.reactions
  for insert with check (user_id = (select auth.uid()) and public.can_view_delivery(delivery_id));
create policy "users change own reaction" on public.reactions
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users remove own reaction" on public.reactions
  for delete using (user_id = (select auth.uid()));

create policy "users read own favorites" on public.prompt_favorites
  for select using (user_id = (select auth.uid()));
create policy "users add own favorites" on public.prompt_favorites
  for insert with check (user_id = (select auth.uid()));
create policy "users remove own favorites" on public.prompt_favorites
  for delete using (user_id = (select auth.uid()));

create policy "follow graph respects profiles" on public.follows
  for select using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
    or (public.can_view_profile(follower_id) and public.can_view_profile(following_id))
  );
create policy "users follow as themselves" on public.follows
  for insert with check (
    follower_id = (select auth.uid()) and public.can_view_profile(following_id)
  );
create policy "users unfollow as themselves" on public.follows
  for delete using (follower_id = (select auth.uid()));

create policy "users read own blocks" on public.blocks
  for select using (blocker_id = (select auth.uid()) or public.is_staff());
create policy "users block as themselves" on public.blocks
  for insert with check (blocker_id = (select auth.uid()));
create policy "users unblock as themselves" on public.blocks
  for delete using (blocker_id = (select auth.uid()));

create policy "stream votes visible with stream" on public.stream_votes
  for select using (exists (select 1 from public.stream_sessions s where s.id = stream_session_id and (s.state in ('lobby', 'live') or s.host_id = (select auth.uid()))));
create policy "users cast stream vote" on public.stream_votes
  for insert with check (
    voter_id = (select auth.uid())
    and exists (select 1 from public.stream_sessions s where s.id = stream_session_id and s.state = 'live' and s.allow_audience_votes)
    and public.can_view_delivery(delivery_id)
  );
create policy "users update own stream vote" on public.stream_votes
  for update using (voter_id = (select auth.uid())) with check (voter_id = (select auth.uid()));

create policy "users read own submissions" on public.line_submissions
  for select using (submitted_by = (select auth.uid()) or public.is_staff());
create policy "users submit lines" on public.line_submissions
  for insert with check (
    submitted_by = (select auth.uid())
    and state = 'review'
    and not public.has_active_restriction((select auth.uid()), 'submission')
  );
create policy "users withdraw pending submissions" on public.line_submissions
  for delete using (submitted_by = (select auth.uid()) and state = 'review');
create policy "staff moderate submissions" on public.line_submissions
  for update using (public.is_staff()) with check (public.is_staff());

create policy "reporters and staff read reports" on public.reports
  for select using (reporter_id = (select auth.uid()) or public.is_staff());
create policy "users create reports" on public.reports
  for insert with check (reporter_id = (select auth.uid()) and state = 'open');
create policy "staff manage reports" on public.reports
  for update using (public.is_staff()) with check (public.is_staff());

create policy "staff read moderation actions" on public.moderation_actions
  for select using (public.is_staff());
create policy "staff create moderation actions" on public.moderation_actions
  for insert with check (public.is_staff() and actor_id = (select auth.uid()));
create policy "staff read restrictions" on public.account_restrictions
  for select using (user_id = (select auth.uid()) or public.is_staff());
create policy "staff manage restrictions" on public.account_restrictions for all
  using (public.is_staff()) with check (public.is_staff());

create policy "users read own subscription" on public.subscriptions
  for select using (user_id = (select auth.uid()) or public.is_staff());
create policy "users read own usage" on public.usage_counters
  for select using (user_id = (select auth.uid()) or public.is_staff());

create policy "active badges are readable" on public.badges
  for select using (is_active or public.is_staff());
create policy "staff manage badges" on public.badges for all
  using (public.is_staff()) with check (public.is_staff());
create policy "earned badges follow profile visibility" on public.user_badges
  for select using (public.can_view_profile(user_id));

create policy "stats follow profile visibility" on public.user_stats
  for select using (public.can_view_profile(user_id));
create policy "category stats follow profile visibility" on public.user_category_stats
  for select using (public.can_view_profile(user_id));
create policy "prompt stats are readable" on public.prompt_stats for select using (true);
create policy "leaderboard snapshots are readable" on public.leaderboard_snapshots
  for select using (public.can_view_profile(user_id));

revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles, public.content_packs, public.prompts,
  public.energy_modifiers, public.pack_prompts, public.trend_campaigns,
  public.trend_prompts, public.daily_challenges, public.stream_sessions,
  public.deliveries, public.delivery_scores, public.challenge_entries,
  public.reactions, public.follows, public.stream_votes, public.badges,
  public.user_badges, public.user_stats, public.user_category_stats,
  public.prompt_stats, public.leaderboard_snapshots
to anon, authenticated;

grant select (
  id, code, created_by, recipient_user_id, prompt_id, energy_modifier_id,
  state, visibility, message, max_entries, expires_at, completed_at,
  created_at, updated_at
) on public.challenges to anon, authenticated;

grant select on public.prompt_favorites, public.line_submissions, public.reports,
  public.account_restrictions, public.subscriptions, public.usage_counters,
  public.profile_preferences, public.blocks
to authenticated;
grant select, insert on public.moderation_actions to authenticated;

grant update (handle, display_name, avatar_path, bio, is_private, locale, last_active_at)
  on public.profiles to authenticated;
grant update (
  timezone, autoplay, captions, reduced_motion, email_challenges,
  email_product_updates, default_delivery_visibility, metadata
) on public.profile_preferences to authenticated;

grant insert (
  code, token_digest, created_by, recipient_user_id, prompt_id,
  energy_modifier_id, state, visibility, message, max_entries, expires_at
) on public.challenges to authenticated;
grant update (recipient_user_id, state, visibility, message, expires_at, completed_at)
  on public.challenges to authenticated;
grant delete on public.challenges to authenticated;

grant insert (
  user_id, prompt_id, energy_modifier_id, challenge_id, stream_session_id,
  daily_challenge_date, daily_challenge_market, state, visibility,
  recording_path, mime_type, duration_ms, byte_size, waveform, transcript, take_count
) on public.deliveries to authenticated;
grant delete on public.deliveries to authenticated;
grant insert on public.challenge_entries to authenticated;
grant insert, update, delete on public.reactions to authenticated;
grant insert, delete on public.prompt_favorites to authenticated;
grant insert, delete on public.follows to authenticated;
grant insert, delete on public.blocks to authenticated;
grant insert, update on public.stream_votes to authenticated;
grant insert (
  submitted_by, proposed_body, proposed_category, proposed_tags,
  suggested_energy, state, automated_labels, automated_scores
) on public.line_submissions to authenticated;
grant delete on public.line_submissions to authenticated;
grant update (state, automated_labels, automated_scores, reviewer_note, promoted_prompt_id, reviewed_by, reviewed_at)
  on public.line_submissions to authenticated;
grant insert (reporter_id, delivery_id, profile_id, prompt_id, submission_id, reason, details, state)
  on public.reports to authenticated;
grant update on public.reports to authenticated;

grant insert, update, delete on public.content_packs, public.prompts,
  public.energy_modifiers, public.pack_prompts, public.trend_campaigns,
  public.trend_prompts, public.daily_challenges, public.badges,
  public.account_restrictions to authenticated;
grant insert, update, delete on public.stream_sessions to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.mark_delivery_judged() from public, anon, authenticated;
revoke all on function public.refresh_user_rollups(uuid) from public, anon, authenticated;
revoke all on function public.refresh_rollups_from_score() from public, anon, authenticated;
revoke all on function public.refresh_follow_counts() from public, anon, authenticated;
revoke all on function public.remove_follows_on_block() from public, anon, authenticated;
revoke all on function public.refresh_reaction_rollup() from public, anon, authenticated;
revoke all on function public.refresh_prompt_stats(uuid) from public, anon, authenticated;
revoke all on function public.refresh_prompt_stats_trigger() from public, anon, authenticated;
revoke all on function public.refresh_rollups_after_delivery_delete() from public, anon, authenticated;
revoke all on function public.validate_challenge_entry() from public, anon, authenticated;
revoke all on function public.advance_challenge_state() from public, anon, authenticated;
revoke all on function public.ensure_daily_challenge(date, text) from public, anon, authenticated;
grant execute on function public.ensure_daily_challenge(date, text) to service_role;

revoke all on function public.is_staff() from public;
revoke all on function public.is_pro(uuid) from public;
revoke all on function public.can_view_profile(uuid) from public;
revoke all on function public.can_view_delivery(uuid) from public;
revoke all on function public.has_active_restriction(uuid, text) from public;
grant execute on function public.is_staff(), public.is_pro(uuid),
  public.can_view_profile(uuid), public.can_view_delivery(uuid),
  public.has_active_restriction(uuid, text) to anon, authenticated;
revoke all on function public.get_challenge_by_invite(text, text) from public;
grant execute on function public.get_challenge_by_invite(text, text) to anon, authenticated;

create or replace view public.delivery_feed
with (security_invoker = true)
as
select
  d.id,
  d.user_id,
  p.handle::text as handle,
  p.display_name,
  p.avatar_path,
  d.prompt_id,
  pr.body as prompt_body,
  pr.category,
  d.energy_modifier_id,
  em.short_label as energy_label,
  d.share_asset_path,
  d.duration_ms,
  d.published_at,
  s.overall,
  s.commitment,
  s.comedy,
  s.accuracy,
  s.chaos,
  s.headline,
  s.verdict,
  coalesce(rc.reaction_count, 0)::bigint as reaction_count
from public.deliveries d
join public.profiles p on p.id = d.user_id
join public.prompts pr on pr.id = d.prompt_id
left join public.energy_modifiers em on em.id = d.energy_modifier_id
join public.delivery_scores s on s.delivery_id = d.id
left join lateral (
  select count(*) as reaction_count from public.reactions r where r.delivery_id = d.id
) rc on true
where d.state = 'judged' and d.visibility = 'public';

create or replace view public.leaderboard_live
with (security_invoker = true)
as
with scored as (
  select
    d.id as delivery_id,
    d.user_id,
    d.created_at,
    p.handle::text as handle,
    p.display_name,
    p.avatar_path,
    s.overall,
    s.commitment,
    s.comedy,
    s.chaos
  from public.deliveries d
  join public.delivery_scores s on s.delivery_id = d.id
  join public.profiles p on p.id = d.user_id
  where d.state = 'judged' and d.visibility = 'public' and not p.is_private
), expanded as (
  select s.*, period.period, metric.metric, metric.score
  from scored s
  cross join lateral (
    values
      ('daily'::text, now() - interval '24 hours'),
      ('weekly'::text, now() - interval '7 days'),
      ('all_time'::text, null::timestamptz)
  ) as period(period, cutoff)
  cross join lateral (
    values
      ('overall'::text, s.overall::numeric),
      ('commitment'::text, s.commitment::numeric),
      ('comedy'::text, s.comedy::numeric),
      ('chaos'::text, s.chaos::numeric)
  ) as metric(metric, score)
  where period.cutoff is null or s.created_at >= period.cutoff
), personal_bests as (
  select distinct on (period, metric, user_id)
    period, metric, user_id, handle, display_name, avatar_path,
    delivery_id, score, created_at
  from expanded
  order by period, metric, user_id, score desc, created_at asc
)
select
  period,
  metric,
  dense_rank() over (partition by period, metric order by score desc)::integer as rank,
  user_id,
  handle,
  display_name,
  avatar_path,
  delivery_id,
  score,
  created_at
from personal_bests;

-- Transitional API alias. `line_submissions` is canonical; this simple view is
-- auto-updatable and retains compatibility with the launch API route.
create or replace view public.user_submissions
with (security_invoker = true)
as
select
  id,
  submitted_by,
  proposed_body,
  proposed_category,
  proposed_tags,
  suggested_energy,
  state,
  automated_labels,
  automated_scores,
  reviewer_note,
  promoted_prompt_id,
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
from public.line_submissions;

grant select on public.delivery_feed, public.leaderboard_live to anon, authenticated;
revoke all on public.user_submissions from anon, authenticated;
grant select, delete on public.user_submissions to authenticated;
grant insert (
  submitted_by, proposed_body, proposed_category, proposed_tags,
  suggested_energy, state, automated_labels, automated_scores
) on public.user_submissions to authenticated;
grant update (
  state, automated_labels, automated_scores, reviewer_note,
  promoted_prompt_id, reviewed_by, reviewed_at
) on public.user_submissions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('delivery-audio', 'delivery-audio', false, 26214400, array['audio/webm', 'video/webm', 'audio/ogg', 'application/ogg', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'audio/wav', 'audio/wave', 'audio/x-wav']),
  ('delivery-share', 'delivery-share', true, 52428800, array['image/png', 'image/webp', 'video/webm', 'video/mp4']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "owners read recordings" on storage.objects
  for select using (
    bucket_id = 'delivery-audio'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_staff())
  );
create policy "owners upload recordings" on storage.objects
  for insert with check (
    bucket_id = 'delivery-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.has_active_restriction((select auth.uid()), 'recording')
  );
create policy "public reads share assets" on storage.objects
  for select using (bucket_id = 'delivery-share');
create policy "public reads avatars" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "owners upload avatars" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "owners update avatars" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "owners delete avatars" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

comment on view public.delivery_feed is 'Public discovery feed. Private recordings require short-lived signed URLs from a trusted server.';
comment on view public.leaderboard_live is 'Live per-user personal bests by rolling period and score dimension.';
comment on view public.user_submissions is 'Transitional auto-updatable alias; new integrations should use line_submissions.';
comment on function public.get_challenge_by_invite(text, text) is 'Constant-scope invite lookup; returns no token digest or private profile fields.';
