-- contbus_live_route_code() is the last function in the schema without a pinned
-- search_path, which the Supabase database linter flags
-- (0011_function_search_path_mutable).
--
-- 20260824120000 left the SET clause off on purpose, to keep the function
-- inlinable into the generator's join. That trade is not worth it: the function
-- is evaluated once per timetable row - a hundred of them - so the planner win
-- is unmeasurable, while an unpinned search_path on a function reachable from
-- two SECURITY DEFINER RPCs is a standing exception the rest of the schema
-- does not make.

create or replace function public.contbus_live_route_code(p_direction text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_direction
    when 'lublin_warszawa' then 'LUB-WAW'
    when 'warszawa_lublin' then 'WAW-LUB'
    when 'lublin_chopin'   then 'LUB-CHP'
    when 'chopin_lublin'   then 'CHP-LUB'
    when 'lublin_modlin'   then 'LUB-MOD'
    when 'modlin_lublin'   then 'MOD-LUB'
    when 'warszawa_chopin' then 'WAW-CHP'
    when 'chopin_warszawa' then 'CHP-WAW'
    when 'warszawa_modlin' then 'WAW-MOD'
    when 'modlin_warszawa' then 'MOD-WAW'
    when 'chopin_modlin'   then 'CHP-MOD'
    when 'modlin_chopin'   then 'MOD-CHP'
  end;
$$;
