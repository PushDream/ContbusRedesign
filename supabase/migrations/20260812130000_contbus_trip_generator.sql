-- Trip generator for the live booking flow.
-- A) Adds the missing reverse-direction routes (Warsaw/airport -> Lublin) so
--    return trips have somewhere to attach to. Only touches `routes`, looked
--    up against the real `stations` table by code - no hardcoded UUIDs.
-- B) Adds generate_contbus_trips(start, end), which reads the contbus_departures
--    timetable (added in 20260812120000_contbus_schedule_tables.sql) and
--    materializes rows into the live `trips` table for a date range. Idempotent
--    via ON CONFLICT DO NOTHING, SECURITY DEFINER so it can bypass RLS on insert,
--    and gated to admins via the existing is_contbus_admin() helper.

-- ---------------------------------------------------------------------------
-- A) Reverse routes
-- ---------------------------------------------------------------------------

-- routes.code must be unique for ON CONFLICT (code) below; the 5 existing
-- rows (LUB-WAW, LUB-CHP, LUB-MOD, CHP-MOD, WAW-MOD) are already distinct.
create unique index if not exists routes_code_uidx on public.routes (code);

insert into public.routes (code, origin_station_id, destination_station_id, base_price, duration_minutes, active)
select v.code, o.id, d.id, v.base_price, v.duration_minutes, true
from (
  values
    ('WAW-LUB', 'WAW-MARRIOTT', 'LUB-DWORCOWA', 50, 150),
    ('CHP-LUB', 'WAW-CHOPIN',   'LUB-DWORCOWA', 60, 140),
    ('MOD-LUB', 'WMI-MODLIN',   'LUB-DWORCOWA', 70, 215),
    ('MOD-WAW', 'WMI-MODLIN',   'WAW-MARRIOTT', 40, 60)
) as v(code, origin_code, destination_code, base_price, duration_minutes)
join public.stations o on o.code = v.origin_code
join public.stations d on d.code = v.destination_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- B) generate_contbus_trips(p_start_date, p_end_date)
-- ---------------------------------------------------------------------------

-- Composite uniqueness so repeated generator runs never double-book a slot.
create unique index if not exists trips_route_departure_uidx
  on public.trips (route_id, departure_date, departure_time);

create or replace function public.generate_contbus_trips(p_start_date date, p_end_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if not public.is_contbus_admin() then
    raise exception 'Only admins can generate trips';
  end if;

  if p_start_date is null or p_end_date is null or p_start_date > p_end_date then
    raise exception 'Invalid date range';
  end if;

  with dates as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as departure_date
  ),
  candidates as (
    select
      d.departure_date,
      dep.departure_time,
      (dep.departure_time + interval '150 minutes')::time as arrival_time,
      r.id as route_id,
      r.base_price as price
    from dates d
    join public.contbus_departures dep
      on dep.is_active = true
     and extract(isodow from d.departure_date)::integer = any(dep.days_of_week)
    join public.routes r
      on r.code = case dep.direction
           when 'lublin_warszawa' then 'LUB-WAW'
           when 'warszawa_lublin' then 'WAW-LUB'
         end
  )
  insert into public.trips (
    route_id, departure_date, departure_time, arrival_time,
    status, capacity, price, driver_id, vehicle_id
  )
  select
    route_id, departure_date, departure_time, arrival_time,
    'scheduled', 40, coalesce(price, 0), null, null
  from candidates
  on conflict (route_id, departure_date, departure_time) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

grant execute on function public.generate_contbus_trips(date, date) to authenticated;
