-- Follow-up concurrency and qualification fixes identified during the final
-- production review of complete_database_hardening.

set lock_timeout = '10s';
set statement_timeout = '120s';

do $$
begin
  if exists (
    select 1
    from public.trips t
    join public.bookings b
      on b.trip_id = t.id
     and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    join public.booking_passengers bp on bp.booking_id = b.id
    group by t.id, t.capacity
    having count(bp.id) > t.capacity
  ) then
    raise exception 'Existing active passengers exceed a declared trip capacity.';
  end if;
end
$$;

drop policy if exists vehicles_operational_select on public.vehicles;
create policy vehicles_operational_select
on public.vehicles
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.trips t
    where t.vehicle_id = public.vehicles.id
      and t.driver_id = (select auth.uid())
  )
);

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
     or private.current_app_role() <> 'driver'::public.app_role then
    raise exception 'Driver account required.' using errcode = '42501';
  end if;

  perform 1
  from public.trips t
  where t.id = p_trip_id
    and t.driver_id = (select auth.uid())
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

create or replace function public.update_staff_trip(p_trip_id uuid, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_trip public.trips%rowtype;
  next_driver_id uuid;
  next_vehicle_id uuid;
  next_capacity integer;
  vehicle_capacity integer;
  occupied integer;
  unsupported_key text;
begin
  if not private.is_staff() then
    raise exception 'Staff account required.' using errcode = '42501';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Trip patch must be an object.' using errcode = '22023';
  end if;

  select key into unsupported_key
  from jsonb_object_keys(p_patch) key
  where key not in ('driver_id', 'vehicle_id', 'platform', 'status')
  limit 1;

  if unsupported_key is not null then
    raise exception 'Unsupported trip field: %', unsupported_key using errcode = '22023';
  end if;

  select t.* into current_trip
  from public.trips t
  where t.id = p_trip_id
  for update;

  if not found then
    return false;
  end if;

  next_driver_id := case
    when p_patch ? 'driver_id' then nullif(p_patch ->> 'driver_id', '')::uuid
    else current_trip.driver_id
  end;
  next_vehicle_id := case
    when p_patch ? 'vehicle_id' then nullif(p_patch ->> 'vehicle_id', '')::uuid
    else current_trip.vehicle_id
  end;
  next_capacity := current_trip.capacity;

  if next_driver_id is not null and not exists (
    select 1
    from public.profiles p
    where p.id = next_driver_id
      and p.role = 'driver'::public.app_role
  ) then
    raise exception 'Assigned profile is not a driver.' using errcode = '23514';
  end if;

  if p_patch ? 'vehicle_id' and next_vehicle_id is not null then
    select v.seats_total into vehicle_capacity
    from public.vehicles v
    where v.id = next_vehicle_id
      and v.active = true;

    if vehicle_capacity is null then
      raise exception 'Assigned vehicle is unavailable.' using errcode = '23503';
    end if;

    select count(*)::integer into occupied
    from public.bookings b
    join public.booking_passengers bp on bp.booking_id = b.id
    where b.trip_id = p_trip_id
      and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status);

    if occupied > vehicle_capacity then
      raise exception 'Assigned vehicle is too small for active passengers.' using errcode = '23514';
    end if;

    next_capacity := least(next_capacity, vehicle_capacity);
  end if;

  update public.trips t
  set
    driver_id = next_driver_id,
    vehicle_id = next_vehicle_id,
    capacity = next_capacity,
    platform = case when p_patch ? 'platform' then nullif(btrim(p_patch ->> 'platform'), '') else t.platform end,
    status = case when p_patch ? 'status' then (p_patch ->> 'status')::public.trip_status else t.status end
  where t.id = p_trip_id;

  return true;
end;
$$;

-- Assessment is read-only. The transfer RPC performs its own locked
-- revalidation, so holding a target-trip write lock here only adds contention.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.assess_ticket_for_trip(text[],uuid)'::regprocedure)
  into function_definition;

  if position(E'\n  for update;\n' in function_definition) = 0 then
    raise exception 'Expected assess_ticket_for_trip lock clause was not found.';
  end if;

  function_definition := replace(
    function_definition,
    E'\n  for update;\n',
    E';\n'
  );
  execute function_definition;
end
$$;

create or replace function public.update_contbus_departure(
  p_departure_id uuid,
  p_patch jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  unsupported_key text;
  changed integer;
  requested_active boolean;
begin
  if not private.is_admin() then
    raise exception 'Administrator account required.' using errcode = '42501';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Departure patch must be an object.' using errcode = '22023';
  end if;

  select key into unsupported_key
  from jsonb_object_keys(p_patch) key
  where key not in ('departure_time', 'direction', 'days_of_week', 'trip_type', 'is_active', 'notes')
  limit 1;

  if unsupported_key is not null then
    raise exception 'Unsupported departure field: %', unsupported_key using errcode = '22023';
  end if;

  if p_patch ? 'days_of_week' and (
    jsonb_typeof(p_patch -> 'days_of_week') <> 'array'
    or jsonb_array_length(p_patch -> 'days_of_week') = 0
    or exists (
      select 1
      from jsonb_array_elements_text(p_patch -> 'days_of_week') day_number
      where day_number::integer not between 1 and 7
    )
  ) then
    raise exception 'Days of week must contain values from 1 through 7.' using errcode = '22023';
  end if;

  if p_patch ?| array['departure_time', 'direction', 'days_of_week'] then
    perform 1
    from public.trips t
    where t.contbus_departure_id = p_departure_id
      and t.departure_date >= current_date
    order by t.id
    for update;

    if exists (
      select 1
      from public.trips t
      join public.bookings b on b.trip_id = t.id
      where t.contbus_departure_id = p_departure_id
        and t.departure_date >= current_date
        and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    ) then
      raise exception 'A timetable with active bookings cannot change its schedule.' using errcode = '23514';
    end if;

    update public.trips t
    set status = 'cancelled'::public.trip_status
    where t.contbus_departure_id = p_departure_id
      and t.departure_date >= current_date
      and t.status not in ('arrived'::public.trip_status, 'cancelled'::public.trip_status);
  end if;

  update public.contbus_departures d
  set
    departure_time = case
      when p_patch ? 'departure_time' then (p_patch ->> 'departure_time')::time
      else d.departure_time
    end,
    direction = case when p_patch ? 'direction' then p_patch ->> 'direction' else d.direction end,
    days_of_week = case
      when p_patch ? 'days_of_week' then array(
        select jsonb_array_elements_text(p_patch -> 'days_of_week')::integer
      )
      else d.days_of_week
    end,
    trip_type = case when p_patch ? 'trip_type' then p_patch ->> 'trip_type' else d.trip_type end,
    notes = case
      when p_patch ? 'notes' then nullif(btrim(p_patch ->> 'notes'), '')
      else d.notes
    end
  where d.id = p_departure_id;

  get diagnostics changed = row_count;
  if changed <> 1 then
    return false;
  end if;

  if p_patch ? 'is_active' then
    requested_active := (p_patch ->> 'is_active')::boolean;
    perform public.set_contbus_departure_active(p_departure_id, requested_active);
  end if;

  return true;
end;
$$;

create or replace function public.delete_contbus_departure(p_departure_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator account required.' using errcode = '42501';
  end if;

  perform 1
  from public.contbus_departures d
  where d.id = p_departure_id
  for update;

  if not found then
    return false;
  end if;

  perform 1
  from public.trips t
  where t.contbus_departure_id = p_departure_id
    and t.departure_date >= current_date
  order by t.id
  for update;

  if exists (
    select 1
    from public.trips t
    join public.bookings b on b.trip_id = t.id
    where t.contbus_departure_id = p_departure_id
      and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
  ) then
    raise exception 'A departure with active bookings cannot be deleted.' using errcode = '23503';
  end if;

  update public.trips t
  set status = 'cancelled'::public.trip_status
  where t.contbus_departure_id = p_departure_id
    and t.departure_date >= current_date
    and t.status not in ('arrived'::public.trip_status, 'cancelled'::public.trip_status);

  delete from public.contbus_departures d
  where d.id = p_departure_id;

  return true;
end;
$$;

create or replace function public.set_contbus_departure_active(
  p_departure_id uuid,
  p_is_active boolean
)
returns public.contbus_departures
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_departure public.contbus_departures%rowtype;
  live_route_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Administrator account required.' using errcode = '42501';
  end if;

  if p_is_active is null then
    raise exception 'Active state is required.' using errcode = '22004';
  end if;

  update public.contbus_departures d
  set is_active = p_is_active
  where d.id = p_departure_id
  returning d.* into selected_departure;

  if not found then
    raise exception 'Departure not found.' using errcode = 'P0002';
  end if;

  select r.id into live_route_id
  from public.routes r
  where r.code = public.contbus_live_route_code(selected_departure.direction)
  limit 1;

  perform 1
  from public.trips t
  where t.departure_date >= current_date
    and (
      t.contbus_departure_id = selected_departure.id
      or (
        live_route_id is not null
        and t.route_id = live_route_id
        and t.departure_time = selected_departure.departure_time
        and extract(isodow from t.departure_date)::integer = any(selected_departure.days_of_week)
        and t.contbus_departure_id is null
      )
    )
  order by t.id
  for update;

  if not p_is_active and exists (
    select 1
    from public.trips t
    join public.bookings b on b.trip_id = t.id
    where t.contbus_departure_id = selected_departure.id
      and t.departure_date >= current_date
      and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
  ) then
    raise exception 'A departure with active bookings cannot be disabled.' using errcode = '23514';
  end if;

  if live_route_id is not null then
    update public.trips t
    set contbus_departure_id = selected_departure.id
    where t.departure_date >= current_date
      and t.route_id = live_route_id
      and t.departure_time = selected_departure.departure_time
      and extract(isodow from t.departure_date)::integer = any(selected_departure.days_of_week)
      and (t.contbus_departure_id is null or t.contbus_departure_id = selected_departure.id);

  end if;

  update public.trips t
  set status = case
    when p_is_active then 'scheduled'::public.trip_status
    else 'cancelled'::public.trip_status
  end
  where t.contbus_departure_id = selected_departure.id
    and t.departure_date >= current_date
    and (
      (p_is_active and t.status = 'cancelled'::public.trip_status)
      or (
        not p_is_active
        and t.status not in ('arrived'::public.trip_status, 'departed'::public.trip_status, 'cancelled'::public.trip_status)
      )
    );

  return selected_departure;
end;
$$;

revoke execute on function public.set_contbus_departure_active(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.report_assigned_trip_incident(uuid, text, text) to authenticated;
grant execute on function public.update_staff_trip(uuid, jsonb) to authenticated;
grant execute on function public.update_contbus_departure(uuid, jsonb) to authenticated;
grant execute on function public.delete_contbus_departure(uuid) to authenticated;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;
