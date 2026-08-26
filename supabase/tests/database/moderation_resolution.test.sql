begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

select has_function(
  'public',
  'resolve_moderation_report',
  array['uuid', 'uuid', 'moderation_decision', 'text', 'text']
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid =
    'public.resolve_moderation_report(uuid,uuid,public.moderation_decision,text,text)'::regprocedure),
  'moderation resolution is security definer'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.resolve_moderation_report(uuid,uuid,public.moderation_decision,text,text)',
    'EXECUTE'
  ),
  'only the trusted service can execute resolution'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.resolve_moderation_report(uuid,uuid,public.moderation_decision,text,text)',
    'EXECUTE'
  ),
  'staff browsers cannot bypass the server route'
);
select ok(
  position(
    '''moderator-limited''' in
      lower(pg_get_functiondef(
        'public.resolve_moderation_report(uuid,uuid,public.moderation_decision,text,text)'::regprocedure
      ))
  ) > 0,
  'delivery limits append the moderator containment label'
);
select ok(
  position(
    '''moderator-removed''' in lower(pg_get_functiondef(
      'public.resolve_moderation_report(uuid,uuid,public.moderation_decision,text,text)'::regprocedure
    ))
  ) > 0,
  'delivery removals append the moderator removal label'
);
select ok(
  not has_table_privilege('authenticated', 'public.reports', 'UPDATE'),
  'authenticated clients cannot resolve reports directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.moderation_actions', 'INSERT'),
  'authenticated clients cannot forge moderation audit actions'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'authenticated clients cannot bypass account API moderation with profile updates'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'users update own profile'
  ),
  0,
  'the direct owner profile-update policy is removed'
);

select has_function('public', 'enforce_profile_moderation_containment', array[]::text[]);
select has_function('public', 'contain_prompt_deliveries', array['uuid', 'boolean']);
select has_function('public', 'enforce_delivery_publication_boundary', array[]::text[]);
select has_trigger('public', 'profiles', 'profiles_enforce_moderation_containment');
select has_trigger('public', 'deliveries', 'deliveries_enforce_publication_boundary');
select ok(
  not has_function_privilege(
    'authenticated',
    'public.contain_prompt_deliveries(uuid,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.enforce_profile_moderation_containment()',
    'EXECUTE'
  ),
  'internal containment helpers are not browser-callable'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'public.account_restrictions',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated staff cannot mutate durable restrictions outside the workflow'
);
select is(
  (select b.public from storage.buckets b where b.id = 'delivery-share'),
  false,
  'share derivatives live in a private bucket'
);
select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public reads share assets'
  ),
  0,
  'anonymous direct share-object reads are removed'
);
select ok(
  position(
    'pr.state = ''published''' in lower(pg_get_functiondef(
      'public.can_view_delivery(uuid)'::regprocedure
    ))
  ) > 0,
  'delivery visibility fails closed for unpublished prompts'
);
select ok(
  position(
    'propagated_prompt_id' in lower(pg_get_functiondef(
      'public.resolve_moderation_report(uuid,uuid,public.moderation_decision,text,text)'::regprocedure
    ))
  ) > 0,
  'submission decisions propagate to a promoted prompt'
);
select ok(
  position(
    '''revokedshareassetpaths''' in lower(pg_get_functiondef(
      'public.resolve_moderation_report(uuid,uuid,public.moderation_decision,text,text)'::regprocedure
    ))
  ) > 0,
  'resolution receipts expose every revoked share derivative path'
);

select * from finish();
rollback;
