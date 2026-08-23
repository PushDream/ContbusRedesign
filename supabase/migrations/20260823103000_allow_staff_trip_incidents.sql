-- Incident reporting was the only operational RPC restricted to the driver role.
-- The driver console admits driver, dispatcher and admin, and driver_assigned_trips
-- returns staff every trip for the day, so a dispatcher or admin could open a trip
-- and change its status or check passengers in, but filing the incident note failed
-- with 42501 'Driver account required.'
--
-- Align this function with update_assigned_trip_status and
-- set_assigned_passenger_check_in: any operational role may report an incident, and
-- staff are not restricted to trips assigned to them. Drivers remain limited to
-- their own trips.
--
-- Note: trip_incidents.driver_id now records whoever filed the report, which for a
-- staff-filed incident is the dispatcher or admin rather than the trip's driver.
-- The column keeps its name to avoid a rename across the existing select policy.

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

  if lower(coalesce(p_severity, '')) not in ('info', 'warning', 'critical') then
    raise exception 'Unsupported incident severity.' using errcode = '22023';
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
