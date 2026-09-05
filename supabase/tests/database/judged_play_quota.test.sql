begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  (
    '55555555-5555-4555-8555-555555555551',
    'quota-free@example.test',
    '{"user_name":"quota_free"}'::jsonb,
    now(), now()
  ),
  (
    '55555555-5555-4555-8555-555555555552',
    'quota-pro@example.test',
    '{"user_name":"quota_pro"}'::jsonb,
    now(), now()
  ),
  (
    '55555555-5555-4555-8555-555555555553',
    'quota-expired@example.test',
    '{"user_name":"quota_expired"}'::jsonb,
    now(), now()
  );

insert into public.subscriptions (
  user_id, tier, state, current_period_start, current_period_end
)
values
  (
    '55555555-5555-4555-8555-555555555552',
    'pro', 'active', now() - interval '1 day', now() + interval '1 day'
  ),
  (
    '55555555-5555-4555-8555-555555555553',
    'pro', 'active', now() - interval '2 days', now() - interval '1 second'
  )
on conflict (user_id) do update set
  tier = excluded.tier, state = excluded.state,
  current_period_start = excluded.current_period_start,
  current_period_end = excluded.current_period_end;

set local "request.jwt.claim.role" = 'service_role';

select is(
  (
    select row(allowed, used, play_limit, remaining, tier, replayed)::text
    from public.reserve_judged_play(
      'quota-free-001',
      '55555555-5555-4555-8555-555555555551'
    )
  ),
  row(true, 1, 5, 4, 'free'::public.plan_tier, false)::text,
  'a free account receives its first judged-play reservation'
);

select is(
  (
    select row(allowed, used, play_limit, remaining, tier, replayed)::text
    from public.reserve_judged_play(
      'quota-free-001',
      '55555555-5555-4555-8555-555555555551'
    )
  ),
  row(true, 1, 5, 4, 'free'::public.plan_tier, true)::text,
  'replaying the same attempt returns its original successful reservation'
);
select is(
  (
    select row(plays, ai_scores)::text
    from public.usage_counters
    where user_id = '55555555-5555-4555-8555-555555555551'
      and period_start = (now() at time zone 'UTC')::date
  ),
  row(1, 1)::text,
  'an idempotent replay does not double-charge either usage counter'
);

do $$
begin
  perform * from public.reserve_judged_play(
    'quota-free-002', '55555555-5555-4555-8555-555555555551'
  );
  perform * from public.reserve_judged_play(
    'quota-free-003', '55555555-5555-4555-8555-555555555551'
  );
  perform * from public.reserve_judged_play(
    'quota-free-004', '55555555-5555-4555-8555-555555555551'
  );
end;
$$;

select is(
  (
    select row(allowed, used, remaining, replayed)::text
    from public.reserve_judged_play(
      'quota-free-005',
      '55555555-5555-4555-8555-555555555551'
    )
  ),
  row(true, 5, 0, false)::text,
  'the fifth distinct free attempt is allowed and exhausts the UTC allowance'
);
select is(
  (
    select row(allowed, used, remaining, replayed)::text
    from public.reserve_judged_play(
      'quota-free-006',
      '55555555-5555-4555-8555-555555555551'
    )
  ),
  row(false, 5, 0, false)::text,
  'the sixth distinct free attempt is denied without incrementing usage'
);
select is(
  (
    select row(allowed, used, remaining, replayed)::text
    from public.reserve_judged_play(
      'quota-free-006',
      '55555555-5555-4555-8555-555555555551'
    )
  ),
  row(false, 5, 0, true)::text,
  'replaying a denied attempt returns the same denial snapshot'
);
select is(
  (
    select row(plays, ai_scores)::text
    from public.usage_counters
    where user_id = '55555555-5555-4555-8555-555555555551'
      and period_start = (now() at time zone 'UTC')::date
  ),
  row(5, 5)::text,
  'the denied attempt and its replay leave both counters capped at five'
);

select ok(
  (
    select released
    from public.release_judged_play(
      (
        select id from public.judged_play_claims
        where user_id = '55555555-5555-4555-8555-555555555551'
          and attempt_key = 'quota-free-005'
      ),
      '55555555-5555-4555-8555-555555555551'
    )
  ),
  'a pre-judgment failure releases its reservation exactly once'
);
select is(
  (
    select row(plays, ai_scores)::text
    from public.usage_counters
    where user_id = '55555555-5555-4555-8555-555555555551'
      and period_start = (now() at time zone 'UTC')::date
  ),
  row(4, 4)::text,
  'release refunds both the play and AI-score counters'
);
select ok(
  not (
    select released
    from public.release_judged_play(
      (
        select id from public.judged_play_claims
        where user_id = '55555555-5555-4555-8555-555555555551'
          and attempt_key = 'quota-free-005'
      ),
      '55555555-5555-4555-8555-555555555551'
    )
  ),
  'releasing the same claim again is an idempotent no-op'
);
select is(
  (
    select row(plays, ai_scores)::text
    from public.usage_counters
    where user_id = '55555555-5555-4555-8555-555555555551'
      and period_start = (now() at time zone 'UTC')::date
  ),
  row(4, 4)::text,
  'an idempotent release cannot double-refund usage'
);

select is(
  (
    select row(allowed, used, remaining, replayed)::text
    from public.reserve_judged_play(
      'quota-free-005',
      '55555555-5555-4555-8555-555555555551'
    )
  ),
  row(true, 5, 0, false)::text,
  'a released provider failure may retry and consume the refunded slot'
);

do $$
begin
  perform * from public.reserve_judged_play(
    'quota-pro-001', '55555555-5555-4555-8555-555555555552'
  );
  perform * from public.reserve_judged_play(
    'quota-pro-002', '55555555-5555-4555-8555-555555555552'
  );
  perform * from public.reserve_judged_play(
    'quota-pro-003', '55555555-5555-4555-8555-555555555552'
  );
  perform * from public.reserve_judged_play(
    'quota-pro-004', '55555555-5555-4555-8555-555555555552'
  );
  perform * from public.reserve_judged_play(
    'quota-pro-005', '55555555-5555-4555-8555-555555555552'
  );
  perform * from public.reserve_judged_play(
    'quota-pro-006', '55555555-5555-4555-8555-555555555552'
  );
end;
$$;

select ok(
  (
    select allowed
      and used = 7
      and play_limit is null
      and remaining is null
      and tier = 'pro'
      and not replayed
    from public.reserve_judged_play(
      'quota-pro-007',
      '55555555-5555-4555-8555-555555555552'
    )
  ),
  'an active Pro account remains unlimited beyond the free ceiling'
);

select is(
  (
    select row(allowed, used, play_limit, remaining, tier)::text
    from public.reserve_judged_play(
      'quota-expired-001',
      '55555555-5555-4555-8555-555555555553'
    )
  ),
  row(true, 1, 5, 4, 'free'::public.plan_tier)::text,
  'an expired Pro period is evaluated as the free tier'
);

select * from finish();
rollback;
