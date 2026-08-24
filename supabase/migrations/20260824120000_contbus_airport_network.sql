-- Bring the airport corridors online end to end.
--
-- The search UI offers four stops (Lublin, Warszawa Marriott, Lotnisko Chopina,
-- Lotnisko Modlin) but the timetable could only describe two directions, so
-- generate_contbus_trips() could only ever materialize LUB-WAW and WAW-LUB.
-- Every airport search returned "no trips" no matter what the admin generated.
--
-- A) Live routes for the three station pairs that had none.
-- B) contbus_departures.direction widened to the full network.
-- C) contbus_live_route_code() maps each direction to its live route.
-- D) generate_contbus_trips() takes arrival from the route's own duration
--    instead of a flat 150 minutes, and reconciles trips whose timetable slot
--    is switched off (or was never linked) so a disabled slot cannot stay
--    sellable.
-- E) A default airport timetable, plus a one-off reconcile of existing trips.

-- ---------------------------------------------------------------------------
-- A) Missing live routes
-- ---------------------------------------------------------------------------

-- routes.code has no unique index any more (dropped as redundant in
-- 20260816191821), so these guard on `not exists` rather than `on conflict`.
insert into public.routes (code, origin_station_id, destination_station_id, base_price, duration_minutes, active)
select v.code, o.id, d.id, v.base_price, v.duration_minutes, true
from (
  values
    ('WAW-CHP', 'WAW-MARRIOTT', 'WAW-CHOPIN',  25, 35),
    ('CHP-WAW', 'WAW-CHOPIN',   'WAW-MARRIOTT', 25, 35),
    ('MOD-CHP', 'WMI-MODLIN',   'WAW-CHOPIN',  50, 55)
) as v(code, origin_code, destination_code, base_price, duration_minutes)
join public.stations o on o.code = v.origin_code
join public.stations d on d.code = v.destination_code
where not exists (select 1 from public.routes r where r.code = v.code);

-- ---------------------------------------------------------------------------
-- B) Timetable directions
-- ---------------------------------------------------------------------------

alter table public.contbus_departures
  drop constraint if exists contbus_departures_direction_check;

alter table public.contbus_departures
  add constraint contbus_departures_direction_check check (
    direction in (
      'lublin_warszawa', 'warszawa_lublin',
      'lublin_chopin', 'chopin_lublin',
      'lublin_modlin', 'modlin_lublin',
      'warszawa_chopin', 'chopin_warszawa',
      'warszawa_modlin', 'modlin_warszawa',
      'chopin_modlin', 'modlin_chopin'
    )
  );

-- ---------------------------------------------------------------------------
-- C) Direction -> live route
-- ---------------------------------------------------------------------------

-- Deliberately left without `set search_path`: the body touches no objects, and
-- a SET clause would stop Postgres inlining it into the generator's joins.
create or replace function public.contbus_live_route_code(p_direction text)
returns text
language sql
immutable
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

-- create_contbus_departure duplicated the two-value whitelist; validate against
-- the mapping above so the two can no longer drift apart.
create or replace function public.create_contbus_departure(
  p_route_id uuid,
  p_departure_time time,
  p_direction text,
  p_days_of_week integer[],
  p_trip_type text,
  p_is_active boolean,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Administrator account required.' using errcode = '42501';
  end if;

  if p_departure_time is null
     or public.contbus_live_route_code(p_direction) is null
     or p_trip_type not in ('regular', 'express')
     or p_days_of_week is null
     or cardinality(p_days_of_week) = 0
     or exists (
       select 1 from unnest(p_days_of_week) day_number where day_number not between 1 and 7
     ) then
    raise exception 'Invalid departure values.' using errcode = '22023';
  end if;

  insert into public.contbus_departures (
    route_id,
    departure_time,
    direction,
    days_of_week,
    trip_type,
    is_active,
    notes
  )
  values (
    p_route_id,
    p_departure_time,
    p_direction,
    p_days_of_week,
    p_trip_type,
    coalesce(p_is_active, true),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into created_id;

  return created_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- D) Generation and reconciliation
-- ---------------------------------------------------------------------------

-- set_contbus_departure_active() only cancels trips at the moment an admin
-- flips a slot, so trips belonging to a slot that was never toggled through the
-- app stayed 'scheduled' while the customer read API hid them, and trips that
-- predate contbus_departure_id stayed sellable after their slot was switched
-- off. Reconciling on every generation run makes the timetable the one truth.
create or replace function private.reconcile_contbus_trips()
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Attach unlinked trips to the slot they came from, so a slot that is
  -- switched off takes its trips with it.
  update public.trips t
  set contbus_departure_id = d.id
  from public.contbus_departures d
  join public.routes r on r.code = public.contbus_live_route_code(d.direction)
  where t.contbus_departure_id is null
    and t.departure_date >= current_date
    and t.route_id = r.id
    and t.departure_time = d.departure_time
    and extract(isodow from t.departure_date)::integer = any(d.days_of_week);

  -- A trip whose slot is switched off must not stay sellable. Trips carrying
  -- live bookings are left alone: those are a dispatcher decision, not a
  -- bookkeeping one.
  update public.trips t
  set status = 'cancelled'::public.trip_status
  from public.contbus_departures d
  where d.id = t.contbus_departure_id
    and not d.is_active
    and t.departure_date >= current_date
    and t.status not in (
      'arrived'::public.trip_status,
      'departed'::public.trip_status,
      'cancelled'::public.trip_status
    )
    and not exists (
      select 1
      from public.bookings b
      where b.trip_id = t.id
        and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    );
end;
$$;

revoke execute on function private.reconcile_contbus_trips() from public, anon, authenticated;

create or replace function public.generate_contbus_trips(p_start_date date, p_end_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if not private.is_admin() then
    raise exception 'Administrator account required.' using errcode = '42501';
  end if;

  if p_start_date is null
     or p_end_date is null
     or p_start_date > p_end_date
     or p_end_date - p_start_date > 366 then
    raise exception 'Invalid date range.' using errcode = '22023';
  end if;

  with dates as (
    select generate_series(p_start_date, p_end_date, interval '1 day')::date as departure_date
  ),
  candidates as (
    select
      departure.id as contbus_departure_id,
      dates.departure_date,
      departure.departure_time,
      (departure.departure_time + make_interval(mins => coalesce(r.duration_minutes, 150)))::time as arrival_time,
      r.id as route_id,
      r.base_price as price
    from dates
    join public.contbus_departures departure
      on departure.is_active
     and extract(isodow from dates.departure_date)::integer = any(departure.days_of_week)
    join public.routes r
      on r.code = public.contbus_live_route_code(departure.direction)
     and r.active
  ),
  upserted as (
    insert into public.trips (
      route_id,
      contbus_departure_id,
      departure_date,
      departure_time,
      arrival_time,
      status,
      capacity,
      price,
      driver_id,
      vehicle_id
    )
    select
      candidates.route_id,
      candidates.contbus_departure_id,
      candidates.departure_date,
      candidates.departure_time,
      candidates.arrival_time,
      'scheduled'::public.trip_status,
      22,
      coalesce(candidates.price, 0),
      null,
      null
    from candidates
    on conflict (route_id, departure_date, departure_time) do update set
      contbus_departure_id = excluded.contbus_departure_id,
      -- The route's duration is the timetable's answer, so a corrected route
      -- length reaches trips that already exist on the next run.
      arrival_time = excluded.arrival_time,
      status = case
        when public.trips.status = 'cancelled'::public.trip_status
         and not exists (
           select 1
           from public.bookings b
           where b.trip_id = public.trips.id
             and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
         )
        then 'scheduled'::public.trip_status
        else public.trips.status
      end
    returning (xmax::text = '0') as inserted
  )
  select count(*)::integer into inserted_count
  from upserted
  where inserted;

  perform private.reconcile_contbus_trips();

  return inserted_count;
end;
$$;

grant execute on function public.generate_contbus_trips(date, date) to authenticated;
grant execute on function public.create_contbus_departure(uuid, time, text, integer[], text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- E) Default airport timetable + one-off reconcile
-- ---------------------------------------------------------------------------

do $$
declare
  timetable_route_id uuid;
begin
  select id into timetable_route_id
  from public.contbus_routes
  order by created_at
  limit 1;

  if timetable_route_id is null then
    insert into public.contbus_routes (name, is_active)
    values ('Contbus - siatka polaczen', true)
    returning id into timetable_route_id;
  end if;

  insert into public.contbus_departures (
    route_id, departure_time, direction, days_of_week, trip_type, is_active
  )
  select
    timetable_route_id,
    slot.departure_time::time,
    slot.direction,
    '{1,2,3,4,5,6,7}'::integer[],
    'regular',
    true
  from (
    values
      ('lublin_chopin', '03:15'), ('lublin_chopin', '05:30'), ('lublin_chopin', '08:00'),
      ('lublin_chopin', '10:30'), ('lublin_chopin', '13:00'), ('lublin_chopin', '16:00'),
      ('chopin_lublin', '07:45'), ('chopin_lublin', '10:15'), ('chopin_lublin', '12:45'),
      ('chopin_lublin', '15:45'), ('chopin_lublin', '18:45'), ('chopin_lublin', '21:45'),
      ('lublin_modlin', '02:30'), ('lublin_modlin', '05:00'), ('lublin_modlin', '09:30'),
      ('lublin_modlin', '14:00'),
      ('modlin_lublin', '08:45'), ('modlin_lublin', '12:15'), ('modlin_lublin', '16:15'),
      ('modlin_lublin', '20:45'),
      ('warszawa_chopin', '05:45'), ('warszawa_chopin', '07:45'), ('warszawa_chopin', '09:45'),
      ('warszawa_chopin', '12:45'), ('warszawa_chopin', '15:45'), ('warszawa_chopin', '18:45'),
      ('chopin_warszawa', '06:50'), ('chopin_warszawa', '08:50'), ('chopin_warszawa', '10:50'),
      ('chopin_warszawa', '13:50'), ('chopin_warszawa', '16:50'), ('chopin_warszawa', '19:50'),
      ('warszawa_modlin', '04:20'), ('warszawa_modlin', '06:50'), ('warszawa_modlin', '09:20'),
      ('warszawa_modlin', '11:50'), ('warszawa_modlin', '14:20'), ('warszawa_modlin', '17:20'),
      ('modlin_warszawa', '06:05'), ('modlin_warszawa', '08:35'), ('modlin_warszawa', '11:05'),
      ('modlin_warszawa', '13:35'), ('modlin_warszawa', '16:05'), ('modlin_warszawa', '19:05'),
      ('chopin_modlin', '07:20'), ('chopin_modlin', '11:20'), ('chopin_modlin', '15:20'),
      ('chopin_modlin', '19:20'),
      ('modlin_chopin', '09:10'), ('modlin_chopin', '13:10'), ('modlin_chopin', '17:10'),
      ('modlin_chopin', '21:10')
  ) as slot(direction, departure_time)
  where not exists (
    select 1
    from public.contbus_departures existing
    where existing.direction = slot.direction
      and existing.departure_time = slot.departure_time::time
  );
end $$;

-- Existing trips predate the reconcile step: 249 future WAW-LUB trips sat on
-- switched-off slots, four slots' worth hidden from customers while staff saw
-- them as scheduled, and one slot's worth still sellable because it was never
-- linked. None carry live bookings.
select private.reconcile_contbus_trips();
