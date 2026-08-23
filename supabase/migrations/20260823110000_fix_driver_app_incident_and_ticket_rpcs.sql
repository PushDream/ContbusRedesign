-- The native driver app (contbus_driver_app) reported incidents with a direct
-- insert into public.trip_incidents. The hardening pass locked that table to
-- select-only -- no insert grant and no insert policy -- so every incident write
-- from the app failed with 42501. The app is being moved onto
-- report_assigned_trip_incident, matching how it already performs trip status
-- updates and passenger check-ins.
--
-- That RPC only accepted 'info', 'warning' and 'critical', but the app has always
-- sent incident *categories*: delay, breakdown, passenger, traffic, luggage,
-- other. The severity column has therefore always carried categories in practice,
-- and the dispatcher dashboard already renders category labels for it. Widen the
-- allowlist to the app's six categories and keep the three legacy values, which
-- existing rows use and the web driver console still sends as its default.

create or replace function public.report_assigned_trip_incident(
  p_trip_id uuid,
  p_severity text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or private.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  perform 1
  from public.trips t
  where t.id = p_trip_id
    and (
      t.driver_id = (select auth.uid())
      or private.is_staff()
    )
  for share;

  if not found then
    raise exception 'Trip is not assigned to this account.' using errcode = '42501';
  end if;

  if lower(coalesce(p_severity, '')) not in (
       'delay', 'breakdown', 'passenger', 'traffic', 'luggage', 'other',
       'info', 'warning', 'critical'
     ) then
    raise exception 'Unsupported incident category.' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_note, ''))) not between 3 and 2000 then
    raise exception 'Incident note must contain 3 to 2000 characters.' using errcode = '22023';
  end if;

  insert into public.trip_incidents (trip_id, driver_id, severity, note)
  values (p_trip_id, (select auth.uid()), lower(p_severity), btrim(p_note));

  return true;
end;
$$;

revoke execute on function public.report_assigned_trip_incident(uuid, text, text) from public, anon;
grant execute on function public.report_assigned_trip_incident(uuid, text, text) to authenticated;

-- 20260816192454_minimize_rpc_allowlist.sql revoked these three on the grounds
-- that no current client calls them. The driver app calls all three from
-- src/lib/database.js (lookupTicketTrip, assessTicketForTrip, transferTicketToTrip),
-- so ticket transfer fails there with the same 42501. Restore them.
grant execute on function public.lookup_ticket_trip(text[]) to authenticated;
grant execute on function public.assess_ticket_for_trip(text[], uuid) to authenticated;
grant execute on function public.transfer_ticket_to_trip(text[], uuid) to authenticated;
