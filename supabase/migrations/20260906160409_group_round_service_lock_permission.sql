-- Group RPCs use SECURITY INVOKER. Grant only the application role the existing
-- account-containment lock helper they call; browser roles remain forbidden.
grant execute on function public.lock_users_for_account_mutation(uuid[]) to service_role;
