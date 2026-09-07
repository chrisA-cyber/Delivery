-- Small private edit recipes and normalized raster avatars reuse existing source
-- ownership, source locks, account-deletion barrier, and the media worker sweep.
create table public.performance_avatar_preferences (
  owner_key text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  avatar jsonb not null check (jsonb_typeof(avatar)='object' and avatar->>'kind' in ('builtin','upload') and octet_length(avatar::text)<=250000),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  check ((user_id is not null and owner_key='user:'||user_id::text and expires_at is null)
    or (user_id is null and owner_key ~ '^guest:[a-f0-9]{64}$' and expires_at is not null))
);
create index performance_avatar_preferences_expiry on public.performance_avatar_preferences(expires_at) where expires_at is not null;
create table public.performance_clip_edits (
  source_kind text not null check(source_kind in ('delivery','classic_video_attempt','switch_attempt','say_attempt','group_take')),
  attempt_id uuid not null,
  owner_key text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  settings jsonb not null check (jsonb_typeof(settings)='object' and settings->>'version'='1' and octet_length(settings::text)<=260000),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key(source_kind,attempt_id),
  check ((user_id is not null and owner_key='user:'||user_id::text) or (user_id is null and owner_key ~ '^guest:[a-f0-9]{64}$'))
);
create index performance_clip_edits_owner on public.performance_clip_edits(owner_key);
create index performance_clip_edits_user on public.performance_clip_edits(user_id) where user_id is not null;
create index performance_clip_edits_expiry on public.performance_clip_edits(expires_at) where expires_at is not null;
alter table public.performance_avatar_preferences enable row level security;
alter table public.performance_clip_edits enable row level security;
revoke all on public.performance_avatar_preferences,public.performance_clip_edits from public,anon,authenticated;
grant all on public.performance_avatar_preferences,public.performance_clip_edits to service_role;

-- A normalized avatar is <=180 KB decoded. Base64 plus the immutable scene
-- manifest remains bounded without putting an image in a public profile row.
alter table public.video_exports drop constraint video_exports_input_check;
alter table public.video_exports add constraint video_exports_input_check check(jsonb_typeof(input)='object' and octet_length(input::text)<=400000);

create function public.save_performance_avatar(p_owner_key text,p_user_id uuid,p_avatar jsonb) returns void
language plpgsql set search_path='' as $$
begin
  if p_user_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-account-delete:'||p_user_id::text,0));
    if p_owner_key is distinct from 'user:'||p_user_id::text or exists(select 1 from public.account_deletion_jobs where user_id=p_user_id) then
      raise exception using errcode='55000',message='ACCOUNT_DELETION_PENDING';
    end if;
  end if;
  insert into public.performance_avatar_preferences(owner_key,user_id,avatar,expires_at)
  values(p_owner_key,p_user_id,p_avatar,case when p_user_id is null then clock_timestamp()+interval '30 days' else null end)
  on conflict(owner_key) do update set avatar=excluded.avatar,updated_at=clock_timestamp(),expires_at=excluded.expires_at;
end;
$$;

create function public.claim_performance_avatar(p_user_id uuid,p_guest_owner_key text) returns void
language plpgsql set search_path='' as $$
begin
  if p_user_id is null or p_guest_owner_key !~ '^guest:[a-f0-9]{64}$' then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-account-delete:'||p_user_id::text,0));
  if exists(select 1 from public.account_deletion_jobs where user_id=p_user_id) then raise exception using errcode='55000',message='ACCOUNT_DELETION_PENDING'; end if;
  insert into public.performance_avatar_preferences(owner_key,user_id,avatar)
  select 'user:'||p_user_id::text,p_user_id,avatar from public.performance_avatar_preferences
  where owner_key=p_guest_owner_key and user_id is null and expires_at>clock_timestamp()
  on conflict(owner_key) do nothing;
  delete from public.performance_avatar_preferences where owner_key=p_guest_owner_key and user_id is null;
end;
$$;

create function public.save_performance_clip_edits(p_source_kind text,p_attempt_id uuid,p_owner_key text,p_user_id uuid,p_settings jsonb) returns void
language plpgsql set search_path='' as $$
declare source jsonb;
begin
  source := public.video_export_source(p_source_kind,p_attempt_id,p_owner_key,p_user_id);
  if source is null then raise exception using errcode='55000',message='EXPORT_SOURCE_UNAVAILABLE'; end if;
  insert into public.performance_clip_edits(source_kind,attempt_id,owner_key,user_id,settings,expires_at)
  values(p_source_kind,p_attempt_id,p_owner_key,p_user_id,p_settings,(source->>'expiresAt')::timestamptz)
  on conflict(source_kind,attempt_id) do update set owner_key=excluded.owner_key,user_id=excluded.user_id,settings=excluded.settings,expires_at=excluded.expires_at,updated_at=clock_timestamp();
end;
$$;

-- Edit recipes follow the take when its established guest claim succeeds. They
-- are erased on deletion; original take content and judging remain untouched.
create function public.contain_source_clip_edits() returns trigger
language plpgsql set search_path='' as $$
declare v_source_kind text:=tg_argv[0]; data jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('delivery-video-source:'||v_source_kind||':'||old.id::text,0));
  if tg_op='DELETE' then
    delete from public.performance_clip_edits e where e.source_kind=v_source_kind and e.attempt_id=old.id;
    return old;
  end if;
  data:=to_jsonb(new);
  if data->>'deleted_at' is not null or data->>'recording_path' is null or data->>'state' in ('removed','deleted')
    or (data->'moderation_labels') ? 'account-deletion' then
    delete from public.performance_clip_edits e where e.source_kind=v_source_kind and e.attempt_id=old.id;
  elsif data->>'user_id' is not null then
    update public.performance_clip_edits e set user_id=(data->>'user_id')::uuid,owner_key='user:'||(data->>'user_id'),expires_at=(data->>'expires_at')::timestamptz
    where e.source_kind=v_source_kind and e.attempt_id=old.id;
  end if;
  return new;
end;
$$;
create trigger delivery_clip_edits after update or delete on public.deliveries for each row execute function public.contain_source_clip_edits('delivery');
create trigger classic_clip_edits after update or delete on public.classic_video_attempts for each row execute function public.contain_source_clip_edits('classic_video_attempt');
create trigger switch_clip_edits after update or delete on public.switch_attempts for each row execute function public.contain_source_clip_edits('switch_attempt');
create trigger say_clip_edits after update or delete on public.say_attempts for each row execute function public.contain_source_clip_edits('say_attempt');
create trigger group_clip_edits after update or delete on public.challenge_group_takes for each row execute function public.contain_source_clip_edits('group_take');

create function public.claim_group_clip_edits() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.user_id is not null and new.user_id is distinct from old.user_id then
    update public.performance_clip_edits e set user_id=new.user_id,owner_key='user:'||new.user_id::text
    where e.source_kind='group_take' and e.attempt_id in(select id from public.challenge_group_takes where member_id=new.id);
  end if;
  return new;
end;
$$;
create trigger group_member_clip_edits after update of user_id on public.challenge_group_members for each row execute function public.claim_group_clip_edits();

create function public.contain_account_clip_edits() returns trigger
language plpgsql set search_path='' as $$
begin
  delete from public.performance_clip_edits where user_id=new.user_id;
  delete from public.performance_avatar_preferences where user_id=new.user_id;
  return new;
end;
$$;
create trigger account_deletion_clip_edits after insert on public.account_deletion_jobs for each row execute function public.contain_account_clip_edits();

create function public.expire_performance_clip_edits(p_limit integer default 100) returns void
language plpgsql set search_path='' as $$
begin
  delete from public.performance_avatar_preferences where owner_key in(select owner_key from public.performance_avatar_preferences where expires_at<=clock_timestamp() order by expires_at limit greatest(1,least(p_limit,1000)));
  delete from public.performance_clip_edits where (source_kind,attempt_id) in(select source_kind,attempt_id from public.performance_clip_edits where expires_at<=clock_timestamp() order by expires_at limit greatest(1,least(p_limit,1000)));
end;
$$;
revoke all on function public.save_performance_avatar(text,uuid,jsonb),public.claim_performance_avatar(uuid,text),public.save_performance_clip_edits(text,uuid,text,uuid,jsonb),public.contain_source_clip_edits(),public.claim_group_clip_edits(),public.contain_account_clip_edits(),public.expire_performance_clip_edits(integer) from public,anon,authenticated;
grant execute on function public.save_performance_avatar(text,uuid,jsonb),public.claim_performance_avatar(uuid,text),public.save_performance_clip_edits(text,uuid,text,uuid,jsonb),public.expire_performance_clip_edits(integer) to service_role;
