-- Atomic quotas for the Hayyiz AI assistant.
-- Identity and limits are derived server-side; clients cannot choose keys or quotas.
create or replace function public.consume_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_user_id uuid := auth.uid();
    v_global_key text := 'assistant:global:' || to_char(now() at time zone 'UTC', 'YYYYMMDD');
begin
    if v_user_id is null then
        raise exception 'Unauthorized: Authentication required.'
            using errcode = '42501';
    end if;

    -- Enforce the account window first so one account cannot burn the
    -- shared daily allowance after it has already exceeded its own quota.
    if not private.check_rate_limit(
        'assistant:user:' || v_user_id::text,
        8,
        600
    ) then
        return false;
    end if;

    -- One atomic UPSERT serializes competing requests against the daily key.
    if not private.check_rate_limit(v_global_key, 100, 86400) then
        return false;
    end if;

    return true;
end;
$function$;

revoke all on function public.consume_ai_quota() from public;
revoke all on function public.consume_ai_quota() from anon;
revoke all on function public.consume_ai_quota() from authenticated;
grant execute on function public.consume_ai_quota() to authenticated;

comment on function public.consume_ai_quota() is
    'Atomically enforces 8 assistant requests per user per 10 minutes and 100 across all users per UTC day. User identity and limits are server-controlled.';

notify pgrst, 'reload schema';
