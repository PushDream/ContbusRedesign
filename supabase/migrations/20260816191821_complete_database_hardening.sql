-- Complete the RPC-boundary rollout: enforce capacity invariants, remove broad
-- table writes, narrow public reads, consolidate RLS, and apply least privilege.

set lock_timeout = '10s';
set statement_timeout = '120s';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = (select auth.uid())),
    'customer'::public.app_role
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() in ('dispatcher', 'admin');
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() = 'admin';
$$;

create or replace function private.is_assigned_driver(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = p_trip_id
      and t.driver_id = (select auth.uid())
  );
$$;

revoke execute on all functions in schema private from public, anon, authenticated;

-- Compatibility wrappers remain available to owner-executed functions but are
-- no longer exposed as Data API RPCs.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$ select private.current_app_role(); $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_staff(); $$;

create or replace function public.is_contbus_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_admin(); $$;

create or replace function public.is_driver_for_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_assigned_driver(target_trip_id) or private.is_staff();
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_booking_reference()
returns text
language plpgsql
set search_path = ''
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  suffix text := '';
  candidate text;
begin
  loop
    suffix := '';
    for i in 1..6 loop
      suffix := suffix || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    candidate := 'CB-' || suffix;
    exit when not exists (
      select 1 from public.bookings b where b.booking_reference = candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.contbus_live_route_code(p_direction text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_direction
    when 'lublin_warszawa' then 'LUB-WAW'
    when 'warszawa_lublin' then 'WAW-LUB'
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        phone = coalesce(excluded.phone, public.profiles.phone);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Ensure timestamps remain server-controlled on mutable business tables.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'stations', 'routes', 'vehicles', 'trips', 'bookings',
    'booking_passengers', 'payments', 'contbus_stops', 'contbus_routes',
    'contbus_departures', 'contbus_fares'
  ] loop
    execute format('drop trigger if exists %I on public.%I', target_table || '_set_updated_at', target_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      target_table || '_set_updated_at', target_table
    );
  end loop;
end
$$;

-- Bring existing trip capacity into line with an assigned vehicle before the
-- invariant triggers are installed. Abort rather than discard valid bookings.
do $$
begin
  if exists (
    select 1
    from public.bookings b
    left join public.booking_passengers bp on bp.booking_id = b.id
    group by b.id, b.passenger_count
    having count(bp.id) <> b.passenger_count
  ) then
    raise exception 'Existing booking passenger counts are inconsistent.';
  end if;

  if exists (
    select 1
    from public.bookings b
    join public.booking_passengers bp on bp.booking_id = b.id
    where b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    group by
      b.trip_id,
      upper(regexp_replace(btrim(bp.seat_number), '\s+', '', 'g'))
    having count(*) > 1
  ) then
    raise exception 'Existing active passengers contain duplicate trip seats.';
  end if;

  if exists (
    select 1
    from public.booking_passengers bp
    where not (
      (
        bp.check_in_status = 'pending'::public.check_in_status
        and bp.checked_in_at is null
        and bp.checked_in_by is null
      ) or (
        bp.check_in_status <> 'pending'::public.check_in_status
        and bp.checked_in_at is not null
        and bp.checked_in_by is not null
      )
    )
  ) then
    raise exception 'Existing passenger check-in tuples are inconsistent.';
  end if;

  if exists (
    select 1
    from public.trips t
    join public.vehicles v on v.id = t.vehicle_id
    where (
      select count(*)
      from public.bookings b
      join public.booking_passengers bp on bp.booking_id = b.id
      where b.trip_id = t.id
        and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    ) > v.seats_total
  ) then
    raise exception 'An assigned vehicle is too small for existing passengers.';
  end if;

  update public.trips t
  set capacity = least(t.capacity, v.seats_total)
  from public.vehicles v
  where v.id = t.vehicle_id
    and t.capacity > v.seats_total;
end
$$;

create or replace function private.enforce_trip_vehicle_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vehicle_capacity integer;
  occupied integer;
begin
  if new.vehicle_id is not null then
    select v.seats_total into vehicle_capacity
    from public.vehicles v
    where v.id = new.vehicle_id;

    if vehicle_capacity is not null and new.capacity > vehicle_capacity then
      raise exception 'Trip capacity (%) exceeds vehicle capacity (%).', new.capacity, vehicle_capacity
        using errcode = '23514';
    end if;
  end if;

  select count(*)::integer into occupied
  from public.bookings b
  join public.booking_passengers bp on bp.booking_id = b.id
  where b.trip_id = new.id
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status);

  if occupied > new.capacity then
    raise exception 'Trip capacity (%) is below the active passenger count (%).', new.capacity, occupied
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_vehicle_seat_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_trip record;
begin
  if new.seats_total is not distinct from old.seats_total then
    return new;
  end if;

  for affected_trip in
    select
      t.id,
      t.capacity,
      (
        select count(*)::integer
        from public.bookings b
        join public.booking_passengers bp on bp.booking_id = b.id
        where b.trip_id = t.id
          and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
      ) as occupied
    from public.trips t
    where t.vehicle_id = new.id
    order by t.id
    for update of t
  loop
    if affected_trip.capacity > new.seats_total then
      raise exception 'Vehicle capacity (%) is below trip capacity (%) for trip %.',
        new.seats_total, affected_trip.capacity, affected_trip.id
        using errcode = '23514';
    end if;

    if affected_trip.occupied > new.seats_total then
      raise exception 'Vehicle capacity (%) is below the active passenger count (%) for trip %.',
        new.seats_total, affected_trip.occupied, affected_trip.id
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$$;

create or replace function private.enforce_passenger_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_trip_id uuid;
  target_booking_status public.booking_status;
  effective_capacity integer;
  occupied integer;
begin
  new.seat_number := upper(regexp_replace(btrim(new.seat_number), '\s+', '', 'g'));

  if new.seat_number = '' then
    raise exception 'Seat number is required.' using errcode = '23514';
  end if;

  select b.trip_id, b.status
  into target_trip_id, target_booking_status
  from public.bookings b
  where b.id = new.booking_id
  for update of b;

  if target_trip_id is null
     or target_booking_status not in ('pending'::public.booking_status, 'paid'::public.booking_status) then
    return new;
  end if;

  select least(t.capacity, coalesce(v.seats_total, t.capacity))
  into effective_capacity
  from public.trips t
  left join public.vehicles v on v.id = t.vehicle_id
  where t.id = target_trip_id
  for update of t;

  if effective_capacity is null then
    raise exception 'Booking trip does not exist.' using errcode = '23503';
  end if;

  select count(*)::integer into occupied
  from public.booking_passengers bp
  join public.bookings b on b.id = bp.booking_id
  where b.trip_id = target_trip_id
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    and bp.id is distinct from new.id;

  if occupied + 1 > effective_capacity then
    raise exception 'Trip capacity exceeded.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.booking_passengers bp
    join public.bookings b on b.id = bp.booking_id
    where b.trip_id = target_trip_id
      and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
      and upper(regexp_replace(btrim(bp.seat_number), '\s+', '', 'g')) = new.seat_number
      and bp.id is distinct from new.id
  ) then
    raise exception 'Seat % is already assigned on this trip.', new.seat_number
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_booking_move_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  effective_capacity integer;
  occupied integer;
  moving integer;
begin
  if new.status not in ('pending'::public.booking_status, 'paid'::public.booking_status) then
    return new;
  end if;

  if new.trip_id is not distinct from old.trip_id
     and not (
       old.status not in ('pending'::public.booking_status, 'paid'::public.booking_status)
       and new.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
     ) then
    return new;
  end if;

  select least(t.capacity, coalesce(v.seats_total, t.capacity))
  into effective_capacity
  from public.trips t
  left join public.vehicles v on v.id = t.vehicle_id
  where t.id = new.trip_id
  for update of t;

  if effective_capacity is null then
    raise exception 'Booking trip does not exist.' using errcode = '23503';
  end if;

  select count(*)::integer into moving
  from public.booking_passengers bp
  where bp.booking_id = new.id;

  select count(*)::integer into occupied
  from public.booking_passengers bp
  join public.bookings b on b.id = bp.booking_id
  where b.trip_id = new.trip_id
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    and b.id <> new.id;

  if occupied + moving > effective_capacity then
    raise exception 'Trip capacity exceeded.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.booking_passengers moving_passenger
    join public.booking_passengers existing_passenger
      on upper(regexp_replace(btrim(existing_passenger.seat_number), '\s+', '', 'g'))
       = upper(regexp_replace(btrim(moving_passenger.seat_number), '\s+', '', 'g'))
    join public.bookings existing_booking on existing_booking.id = existing_passenger.booking_id
    where moving_passenger.booking_id = new.id
      and existing_booking.id <> new.id
      and existing_booking.trip_id = new.trip_id
      and existing_booking.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
  ) then
    raise exception 'One or more seats are already assigned on the destination trip.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_booking_passenger_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking_id uuid;
  target_ids uuid[] := array[]::uuid[];
  expected integer;
  actual integer;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    target_ids := array_append(target_ids, new.id);
    if tg_table_name = 'booking_passengers' then
      target_ids[array_length(target_ids, 1)] := new.booking_id;
    end if;
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    if tg_table_name = 'booking_passengers' then
      target_ids := array_append(target_ids, old.booking_id);
    else
      target_ids := array_append(target_ids, old.id);
    end if;
  end if;

  foreach target_booking_id in array target_ids loop
    select b.passenger_count into expected
    from public.bookings b
    where b.id = target_booking_id;

    if found then
      select count(*)::integer into actual
      from public.booking_passengers bp
      where bp.booking_id = target_booking_id;

      if actual <> expected then
        raise exception 'Booking passenger count mismatch: expected %, found %.', expected, actual
          using errcode = '23514';
      end if;
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

alter table public.booking_passengers
  drop constraint if exists booking_passengers_check_in_tuple_check;
alter table public.booking_passengers
  add constraint booking_passengers_check_in_tuple_check check (
    (
      check_in_status = 'pending'::public.check_in_status
      and checked_in_at is null
      and checked_in_by is null
    ) or (
      check_in_status <> 'pending'::public.check_in_status
      and checked_in_at is not null
      and checked_in_by is not null
    )
  );

drop trigger if exists trips_capacity_vehicle_guard on public.trips;
create trigger trips_capacity_vehicle_guard
before insert or update of vehicle_id, capacity on public.trips
for each row execute function private.enforce_trip_vehicle_capacity();

drop trigger if exists vehicles_seat_capacity_guard on public.vehicles;
create trigger vehicles_seat_capacity_guard
before update of seats_total on public.vehicles
for each row execute function private.enforce_vehicle_seat_capacity();

drop trigger if exists booking_passengers_capacity_guard on public.booking_passengers;
create trigger booking_passengers_capacity_guard
before insert or update of booking_id, seat_number on public.booking_passengers
for each row execute function private.enforce_passenger_capacity();

drop trigger if exists bookings_move_capacity_guard on public.bookings;
create trigger bookings_move_capacity_guard
before update of trip_id, status on public.bookings
for each row execute function private.enforce_booking_move_capacity();

drop trigger if exists booking_passengers_count_guard on public.booking_passengers;
create constraint trigger booking_passengers_count_guard
after insert or update or delete on public.booking_passengers
deferrable initially deferred
for each row execute function private.enforce_booking_passenger_count();

drop trigger if exists bookings_passenger_count_guard on public.bookings;
create constraint trigger bookings_passenger_count_guard
after insert or update on public.bookings
deferrable initially deferred
for each row execute function private.enforce_booking_passenger_count();

-- Foreign-key coverage and redundant-index cleanup.
create index if not exists booking_passengers_checked_in_by_idx on public.booking_passengers(checked_in_by);
create index if not exists contbus_route_stops_stop_id_idx on public.contbus_route_stops(stop_id);
create index if not exists route_stops_station_id_idx on public.route_stops(station_id);
create index if not exists routes_destination_station_id_idx on public.routes(destination_station_id);
create index if not exists trip_events_actor_id_idx on public.trip_events(actor_id);
create index if not exists trip_events_trip_id_idx on public.trip_events(trip_id);
create index if not exists trip_incidents_driver_id_idx on public.trip_incidents(driver_id);
create index if not exists trip_incidents_trip_id_idx on public.trip_incidents(trip_id);
create index if not exists trips_vehicle_id_idx on public.trips(vehicle_id);

drop index if exists public.routes_code_uidx;
drop index if exists public.trips_route_departure_uidx;
drop index if exists public.booking_passengers_ticket_code_idx;
drop index if exists public.contbus_route_stops_route_id_idx;
drop index if exists public.contbus_fares_origin_idx;

-- Narrow read APIs keep customer and public clients away from operational
-- columns while preserving the data shapes used by the application.
create or replace function public.public_trip_schedule(p_date date)
returns table (
  id uuid,
  route_id uuid,
  departure_date date,
  departure_time time,
  arrival_time time,
  status public.trip_status,
  platform text,
  capacity integer,
  price numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.route_id,
    t.departure_date,
    t.departure_time,
    t.arrival_time,
    t.status,
    t.platform,
    greatest(
      least(t.capacity, coalesce(v.seats_total, t.capacity)) - coalesce(occupied.passenger_count, 0),
      0
    )::integer as capacity,
    t.price
  from public.trips t
  left join public.vehicles v on v.id = t.vehicle_id
  left join public.contbus_departures departure on departure.id = t.contbus_departure_id
  left join lateral (
    select count(*)::integer as passenger_count
    from public.bookings b
    join public.booking_passengers bp on bp.booking_id = b.id
    where b.trip_id = t.id
      and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
  ) occupied on true
  where t.departure_date = p_date
    and t.status not in ('arrived'::public.trip_status, 'cancelled'::public.trip_status)
    and (t.contbus_departure_id is null or departure.is_active)
  order by t.departure_time;
$$;

create or replace function public.customer_booking_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'reference', b.booking_reference,
          'status', b.status,
          'passengerCount', b.passenger_count,
          'totalAmount', b.total_amount,
          'currency', b.currency,
          'createdAt', b.created_at,
          'buyerEmail', b.buyer_email::text,
          'buyerName', b.buyer_name,
          'route', origin.name || ' - ' || destination.name,
          'departureDate', t.departure_date,
          'departureTime', t.departure_time,
          'arrivalTime', t.arrival_time,
          'platform', t.platform,
          'seatNumbers', coalesce(passengers.seat_numbers, array[]::text[]),
          'ticketCodes', coalesce(passengers.ticket_codes, array[]::text[])
        )
        order by b.created_at desc
      )
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      join public.routes r on r.id = t.route_id
      join public.stations origin on origin.id = r.origin_station_id
      join public.stations destination on destination.id = r.destination_station_id
      left join lateral (
        select
          array_agg(bp.seat_number order by bp.created_at) as seat_numbers,
          array_agg(bp.ticket_code order by bp.created_at) as ticket_codes
        from public.booking_passengers bp
        where bp.booking_id = b.id
      ) passengers on true
      where b.customer_id = (select auth.uid())
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.driver_assigned_trips(p_date date)
returns table (
  id uuid,
  route_id uuid,
  departure_date date,
  departure_time time,
  arrival_time time,
  status public.trip_status,
  driver_id uuid,
  vehicle_id uuid,
  platform text,
  capacity integer,
  price numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or private.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  return query
  select
    t.id,
    t.route_id,
    t.departure_date,
    t.departure_time,
    t.arrival_time,
    t.status,
    t.driver_id,
    t.vehicle_id,
    t.platform,
    t.capacity,
    t.price
  from public.trips t
  where t.departure_date = p_date
    and t.status <> 'cancelled'::public.trip_status
    and (
      t.driver_id = (select auth.uid())
      or private.is_staff()
    )
  order by t.departure_time;
end;
$$;

create or replace function public.update_assigned_trip_status(
  p_trip_id uuid,
  p_status public.trip_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.trip_status;
  assigned_driver uuid;
begin
  if (select auth.uid()) is null
     or private.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  if p_status is null or p_status = 'cancelled'::public.trip_status then
    raise exception 'Unsupported trip status.' using errcode = '22023';
  end if;

  select t.status, t.driver_id
  into current_status, assigned_driver
  from public.trips t
  where t.id = p_trip_id
  for update;

  if not found
     or (assigned_driver is distinct from (select auth.uid()) and not private.is_staff()) then
    return false;
  end if;

  if current_status is not distinct from p_status then
    return true;
  end if;

  if not private.is_staff()
     and not (
       (current_status = 'scheduled' and p_status in ('boarding', 'delayed'))
       or (current_status = 'boarding' and p_status in ('departed', 'delayed'))
       or (current_status = 'delayed' and p_status in ('boarding', 'departed', 'arrived'))
       or (current_status = 'departed' and p_status in ('delayed', 'arrived'))
     ) then
    raise exception 'Unsupported trip status transition: % to %.', current_status, p_status
      using errcode = '22023';
  end if;

  update public.trips t
  set status = p_status
  where t.id = p_trip_id;

  insert into public.trip_events (trip_id, actor_id, event_type, payload)
  values (
    p_trip_id,
    (select auth.uid()),
    'trip_status_changed',
    jsonb_build_object('from', current_status, 'to', p_status)
  );

  return true;
end;
$$;

create or replace function public.set_assigned_passenger_check_in(
  p_passenger_id uuid,
  p_checked_in boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking_id uuid;
  target_trip_id uuid;
begin
  if p_checked_in is null then
    raise exception 'Check-in action is required.' using errcode = '22004';
  end if;

  if (select auth.uid()) is null
     or private.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  select bp.booking_id
  into target_booking_id
  from public.booking_passengers bp
  where bp.id = p_passenger_id;

  select b.trip_id
  into target_trip_id
  from public.bookings b
  where b.id = target_booking_id
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
  for update of b;

  perform 1
  from public.trips t
  where t.id = target_trip_id
  for update;

  perform 1
  from public.booking_passengers bp
  where bp.id = p_passenger_id
    and bp.booking_id = target_booking_id
  for update;

  if not found then
    raise exception 'Passenger changed while the action was being applied.' using errcode = '40001';
  end if;

  if target_trip_id is null
     or (not private.is_assigned_driver(target_trip_id) and not private.is_staff()) then
    raise exception 'Passenger is not on an assigned trip.' using errcode = '42501';
  end if;

  update public.booking_passengers bp
  set
    check_in_status = case
      when p_checked_in then 'boarded'::public.check_in_status
      else 'pending'::public.check_in_status
    end,
    checked_in_at = case when p_checked_in then statement_timestamp() else null end,
    checked_in_by = case when p_checked_in then (select auth.uid()) else null end
  where bp.id = p_passenger_id
    and bp.booking_id = target_booking_id;

  insert into public.trip_events (trip_id, actor_id, event_type, payload)
  values (
    target_trip_id,
    (select auth.uid()),
    case when p_checked_in then 'passenger_checked_in' else 'passenger_check_in_reversed' end,
    jsonb_build_object('passenger_id', p_passenger_id)
  );

  return true;
end;
$$;

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

  if not private.is_assigned_driver(p_trip_id) then
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

create or replace function public.set_profile_role(
  target_profile_id uuid,
  target_role public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  if not private.is_admin() then
    raise exception 'Administrator account required.' using errcode = '42501';
  end if;

  update public.profiles p
  set role = target_role
  where p.id = target_profile_id
  returning p.* into updated_profile;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return updated_profile;
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

  if next_vehicle_id is not null then
    select v.seats_total into vehicle_capacity
    from public.vehicles v
    where v.id = next_vehicle_id
      and v.active = true
    for share;

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

create or replace function public.update_staff_booking_status(
  p_booking_id uuid,
  p_status public.booking_status
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'Staff account required.' using errcode = '42501';
  end if;

  update public.bookings b
  set status = p_status
  where b.id = p_booking_id;

  return found;
end;
$$;

-- Booking creation is serialized on the trip row. Both the declared trip
-- capacity and the assigned vehicle seat count are authoritative limits.
create or replace function public.create_public_booking_with_seats(
  p_trip_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_passenger_count integer,
  p_seat_numbers text[],
  p_luggage boolean default false,
  p_insurance boolean default false,
  p_payment_method text default 'blik'
)
returns table (
  booking_id uuid,
  booking_reference text,
  ticket_code text,
  ticket_codes text[],
  seat_numbers text[],
  total_amount numeric,
  trip_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_trip public.trips%rowtype;
  effective_capacity integer;
  occupied integer;
  new_booking_id uuid;
  new_reference text;
  extras_total numeric := 0;
  calculated_total numeric;
  normalized_seats text[];
  selected_seat text;
  created_ticket_codes text[] := array[]::text[];
begin
  if p_passenger_count is null or p_passenger_count < 1 or p_passenger_count > 8 then
    raise exception 'Passenger count must be between 1 and 8.' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_buyer_name, ''))) < 3 then
    raise exception 'Buyer name is required.' using errcode = '22023';
  end if;

  if position('@' in coalesce(p_buyer_email, '')) < 2 then
    raise exception 'Valid buyer email is required.' using errcode = '22023';
  end if;

  select array_agg(normalized_seat order by normalized_seat)
  into normalized_seats
  from (
    select distinct upper(regexp_replace(btrim(seat), '\s+', '', 'g')) as normalized_seat
    from unnest(coalesce(p_seat_numbers, array[]::text[])) seat
    where length(upper(regexp_replace(btrim(seat), '\s+', '', 'g'))) >= 2
  ) requested;

  if coalesce(array_length(normalized_seats, 1), 0) <> p_passenger_count then
    raise exception 'Choose one unique seat for each passenger.' using errcode = '22023';
  end if;

  select t.*
  into selected_trip
  from public.trips t
  left join public.contbus_departures departure on departure.id = t.contbus_departure_id
  where t.id = p_trip_id
    and t.status in (
      'scheduled'::public.trip_status,
      'boarding'::public.trip_status,
      'delayed'::public.trip_status
    )
    and (t.contbus_departure_id is null or departure.is_active)
  for update of t;

  if not found then
    raise exception 'Trip is not available.' using errcode = 'P0002';
  end if;

  select least(selected_trip.capacity, coalesce(v.seats_total, selected_trip.capacity))
  into effective_capacity
  from (values (1)) singleton(value)
  left join public.vehicles v on v.id = selected_trip.vehicle_id;

  select count(*)::integer
  into occupied
  from public.bookings b
  join public.booking_passengers bp on bp.booking_id = b.id
  where b.trip_id = p_trip_id
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status);

  if occupied + p_passenger_count > effective_capacity then
    raise exception 'Trip capacity exceeded.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.bookings b
    join public.booking_passengers bp on bp.booking_id = b.id
    where b.trip_id = p_trip_id
      and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
      and upper(regexp_replace(btrim(bp.seat_number), '\s+', '', 'g')) = any(normalized_seats)
  ) then
    raise exception 'One or more selected seats are already taken.' using errcode = '23505';
  end if;

  extras_total :=
    case when coalesce(p_luggage, false) then 12 else 0 end
    + case when coalesce(p_insurance, false) then 8 else 0 end;
  calculated_total := (selected_trip.price * p_passenger_count) + extras_total;
  new_reference := public.generate_booking_reference();

  insert into public.bookings (
    booking_reference,
    customer_id,
    trip_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    passenger_count,
    status,
    total_amount,
    currency
  )
  values (
    new_reference,
    (select auth.uid()),
    p_trip_id,
    btrim(p_buyer_name),
    btrim(p_buyer_email),
    nullif(btrim(coalesce(p_buyer_phone, '')), ''),
    p_passenger_count,
    'paid'::public.booking_status,
    calculated_total,
    'PLN'
  )
  returning id into new_booking_id;

  insert into public.booking_extras (booking_id, luggage_count, insurance, amount)
  values (
    new_booking_id,
    case when coalesce(p_luggage, false) then 1 else 0 end,
    coalesce(p_insurance, false),
    extras_total
  );

  foreach selected_seat in array normalized_seats loop
    created_ticket_codes := array_append(
      created_ticket_codes,
      new_reference || '-' || selected_seat
    );

    insert into public.booking_passengers (
      booking_id,
      full_name,
      seat_number,
      ticket_code
    )
    values (
      new_booking_id,
      btrim(p_buyer_name),
      selected_seat,
      created_ticket_codes[array_length(created_ticket_codes, 1)]
    );
  end loop;

  insert into public.payments (
    booking_id,
    provider,
    provider_reference,
    status,
    amount,
    currency
  )
  values (
    new_booking_id,
    coalesce(nullif(btrim(p_payment_method), ''), 'prototype'),
    new_reference,
    'paid'::public.payment_status,
    calculated_total,
    'PLN'
  );

  return query
  select
    new_booking_id,
    new_reference,
    created_ticket_codes[1],
    created_ticket_codes,
    normalized_seats,
    calculated_total,
    p_trip_id;
end;
$$;

create or replace function public.create_public_booking(
  p_trip_id uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_passenger_count integer,
  p_seat_number text,
  p_luggage boolean default false,
  p_insurance boolean default false,
  p_payment_method text default 'blik'
)
returns table (
  booking_id uuid,
  booking_reference text,
  ticket_code text,
  total_amount numeric,
  trip_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_passenger_count <> 1 then
    raise exception 'The single-seat booking API requires exactly one passenger.'
      using errcode = '22023';
  end if;

  return query
  select
    created.booking_id,
    created.booking_reference,
    created.ticket_code,
    created.total_amount,
    created.trip_id
  from public.create_public_booking_with_seats(
    p_trip_id,
    p_buyer_name,
    p_buyer_email,
    p_buyer_phone,
    p_passenger_count,
    array[p_seat_number],
    p_luggage,
    p_insurance,
    p_payment_method
  ) created;
end;
$$;

create or replace function public.lookup_public_booking(p_code text, p_email text)
returns table (
  booking_id uuid,
  booking_reference text,
  booking_status text,
  buyer_name text,
  buyer_email text,
  passenger_count integer,
  total_amount numeric,
  currency text,
  departure_date date,
  departure_time time,
  arrival_time time,
  platform text,
  route_label text,
  seat_numbers text[],
  ticket_codes text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if length(btrim(coalesce(p_code, ''))) < 3
     or position('@' in coalesce(p_email, '')) < 2 then
    return;
  end if;

  return query
  select
    b.id,
    b.booking_reference,
    b.status::text,
    b.buyer_name,
    b.buyer_email::text,
    b.passenger_count,
    b.total_amount,
    b.currency,
    t.departure_date,
    t.departure_time,
    t.arrival_time,
    t.platform,
    origin.name || ' - ' || destination.name,
    array_agg(bp.seat_number order by bp.created_at),
    array_agg(bp.ticket_code order by bp.created_at)
  from public.bookings b
  join public.trips t on t.id = b.trip_id
  join public.routes r on r.id = t.route_id
  join public.stations origin on origin.id = r.origin_station_id
  join public.stations destination on destination.id = r.destination_station_id
  join public.booking_passengers bp on bp.booking_id = b.id
  where lower(btrim(b.buyer_email::text)) = lower(btrim(p_email))
    and (
      upper(b.booking_reference) = upper(btrim(p_code))
      or exists (
        select 1
        from public.booking_passengers matched
        where matched.booking_id = b.id
          and upper(matched.ticket_code) = upper(btrim(p_code))
      )
    )
  group by b.id, t.id, origin.name, destination.name
  limit 1;
end;
$$;

create or replace function public.cancel_public_booking(p_code text, p_email text)
returns table (
  booking_id uuid,
  booking_reference text,
  booking_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_booking_id uuid;
begin
  select b.id
  into matched_booking_id
  from public.bookings b
  where lower(btrim(b.buyer_email::text)) = lower(btrim(p_email))
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    and (
      upper(b.booking_reference) = upper(btrim(p_code))
      or exists (
        select 1
        from public.booking_passengers bp
        where bp.booking_id = b.id
          and upper(bp.ticket_code) = upper(btrim(p_code))
      )
    )
  order by b.created_at desc
  limit 1
  for update;

  if matched_booking_id is null then
    return;
  end if;

  update public.bookings b
  set status = 'cancelled'::public.booking_status
  where b.id = matched_booking_id;

  return query
  select b.id, b.booking_reference, b.status::text
  from public.bookings b
  where b.id = matched_booking_id;
end;
$$;

-- Administrative timetable writes are exposed only through allowlisted RPCs.
create or replace function public.staff_schedule_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'Staff account required.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'stops', coalesce(
      (select jsonb_agg(to_jsonb(s) order by s.stop_order, s.name) from public.contbus_stops s),
      '[]'::jsonb
    ),
    'routes', coalesce(
      (select jsonb_agg(to_jsonb(r) order by r.name) from public.contbus_routes r),
      '[]'::jsonb
    ),
    'routeStops', coalesce(
      (
        select jsonb_agg(to_jsonb(rs) order by rs.route_id, rs.stop_order)
        from public.contbus_route_stops rs
      ),
      '[]'::jsonb
    ),
    'departures', coalesce(
      (
        select jsonb_agg(to_jsonb(d) order by d.departure_time, d.direction)
        from public.contbus_departures d
      ),
      '[]'::jsonb
    ),
    'fares', coalesce(
      (
        select jsonb_agg(to_jsonb(f) order by f.origin_stop_id, f.destination_stop_id)
        from public.contbus_fares f
      ),
      '[]'::jsonb
    )
  );
end;
$$;

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
     or p_direction not in ('lublin_warszawa', 'warszawa_lublin')
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

create or replace function public.update_contbus_stop(p_stop_id uuid, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  unsupported_key text;
begin
  if not private.is_admin() then
    raise exception 'Administrator account required.' using errcode = '42501';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Stop patch must be an object.' using errcode = '22023';
  end if;

  select key into unsupported_key
  from jsonb_object_keys(p_patch) key
  where key not in ('name', 'city', 'address')
  limit 1;

  if unsupported_key is not null then
    raise exception 'Unsupported stop field: %', unsupported_key using errcode = '22023';
  end if;

  update public.contbus_stops s
  set
    name = case when p_patch ? 'name' then btrim(p_patch ->> 'name') else s.name end,
    city = case when p_patch ? 'city' then nullif(btrim(p_patch ->> 'city'), '') else s.city end,
    address = case when p_patch ? 'address' then nullif(btrim(p_patch ->> 'address'), '') else s.address end
  where s.id = p_stop_id;

  return found;
end;
$$;

create or replace function public.update_contbus_fare_price(p_fare_id uuid, p_price_pln numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator account required.' using errcode = '42501';
  end if;

  if p_price_pln is null or p_price_pln < 0 then
    raise exception 'Fare price must be non-negative.' using errcode = '22023';
  end if;

  update public.contbus_fares f
  set price_pln = p_price_pln
  where f.id = p_fare_id;

  return found;
end;
$$;

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
      (departure.departure_time + interval '150 minutes')::time as arrival_time,
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

  return inserted_count;
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

  if live_route_id is not null then
    update public.trips t
    set contbus_departure_id = selected_departure.id
    where t.departure_date >= current_date
      and t.route_id = live_route_id
      and t.departure_time = selected_departure.departure_time
      and extract(isodow from t.departure_date)::integer = any(selected_departure.days_of_week)
      and (t.contbus_departure_id is null or t.contbus_departure_id = selected_departure.id);

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
      )
      and not exists (
        select 1
        from public.bookings b
        where b.trip_id = t.id
          and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
      );
  end if;

  return selected_departure;
end;
$$;

create or replace function public.dispatcher_dashboard_overview(p_date date default current_date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'Staff account required.' using errcode = '42501';
  end if;

  return (
    with booking_totals as (
      select
        b.trip_id,
        count(*) filter (
          where b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
        )::integer as booking_count,
        coalesce(sum(b.passenger_count) filter (
          where b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
        ), 0)::integer as passenger_count,
        coalesce(sum(b.total_amount) filter (where b.status = 'paid'::public.booking_status), 0) as revenue_total
      from public.bookings b
      group by b.trip_id
    ),
    selected_trips as (
      select
        t.id,
        t.route_id,
        t.departure_date,
        t.departure_time,
        t.arrival_time,
        t.status,
        t.platform,
        t.capacity,
        t.price,
        r.code as route_code,
        r.duration_minutes,
        r.base_price,
        origin.name as origin_name,
        destination.name as destination_name,
        v.label as vehicle_label,
        v.plate_number,
        coalesce(bt.booking_count, 0) as booking_count,
        coalesce(bt.passenger_count, 0) as passenger_count,
        coalesce(bt.revenue_total, 0) as revenue_total
      from public.trips t
      join public.routes r on r.id = t.route_id
      join public.stations origin on origin.id = r.origin_station_id
      join public.stations destination on destination.id = r.destination_station_id
      left join public.vehicles v on v.id = t.vehicle_id
      left join booking_totals bt on bt.trip_id = t.id
      where t.departure_date = p_date
        and t.status <> 'cancelled'::public.trip_status
    ),
    route_totals as (
      select
        r.id,
        r.code,
        origin.name as origin_name,
        destination.name as destination_name,
        r.duration_minutes,
        r.base_price,
        count(st.id)::integer as trips_today,
        coalesce(sum(st.booking_count), 0)::integer as bookings_today,
        coalesce(sum(st.revenue_total), 0) as revenue_today
      from public.routes r
      join public.stations origin on origin.id = r.origin_station_id
      join public.stations destination on destination.id = r.destination_station_id
      left join selected_trips st on st.route_id = r.id
      where r.active
      group by r.id, origin.name, destination.name
    ),
    recent_bookings as (
      select
        b.id,
        b.booking_reference,
        b.passenger_count,
        b.total_amount,
        b.status,
        origin.name as origin_name,
        destination.name as destination_name,
        b.created_at
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      join public.routes r on r.id = t.route_id
      join public.stations origin on origin.id = r.origin_station_id
      join public.stations destination on destination.id = r.destination_station_id
      where t.departure_date = p_date
      order by b.created_at desc
      limit 10
    )
    select jsonb_build_object(
      'date', p_date,
      'summary', jsonb_build_object(
        'trips', (select count(*) from selected_trips),
        'bookings', (select coalesce(sum(booking_count), 0) from selected_trips),
        'passengers', (select coalesce(sum(passenger_count), 0) from selected_trips),
        'revenue', (select coalesce(sum(revenue_total), 0) from selected_trips),
        'routes', (select count(*) from public.routes r where r.active),
        'vehicles', (select count(*) from public.vehicles v where v.active)
      ),
      'trips', coalesce(
        (select jsonb_agg(to_jsonb(st) order by st.departure_time) from selected_trips st),
        '[]'::jsonb
      ),
      'routes', coalesce(
        (select jsonb_agg(to_jsonb(rt) order by rt.code) from route_totals rt),
        '[]'::jsonb
      ),
      'recent_bookings', coalesce(
        (select jsonb_agg(to_jsonb(rb) order by rb.created_at desc) from recent_bookings rb),
        '[]'::jsonb
      ),
      'status_totals', coalesce(
        (
          select jsonb_object_agg(status::text, status_count)
          from (
            select st.status, count(*)::integer as status_count
            from selected_trips st
            group by st.status
          ) grouped_status
        ),
        '{}'::jsonb
      )
    )
  );
end;
$$;

create or replace function public.lookup_ticket_trip(p_codes text[])
returns table (
  trip_id uuid,
  route_label text,
  departure_date date,
  departure_time time,
  arrival_time time,
  platform text,
  booking_status text,
  booking_reference text,
  ticket_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_codes text[];
begin
  if (select auth.uid()) is null
     or private.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  select array_agg(upper(btrim(code)))
  into normalized_codes
  from unnest(coalesce(p_codes, array[]::text[])) code
  where btrim(code) <> '';

  return query
  select
    t.id,
    origin.name || ' - ' || destination.name,
    t.departure_date,
    t.departure_time,
    t.arrival_time,
    t.platform,
    b.status::text,
    b.booking_reference,
    bp.ticket_code
  from public.booking_passengers bp
  join public.bookings b on b.id = bp.booking_id
  join public.trips t on t.id = b.trip_id
  join public.routes r on r.id = t.route_id
  join public.stations origin on origin.id = r.origin_station_id
  join public.stations destination on destination.id = r.destination_station_id
  where b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    and (
      upper(bp.ticket_code) = any(normalized_codes)
      or upper(b.booking_reference) = any(normalized_codes)
    )
    and (t.driver_id = (select auth.uid()) or private.is_staff())
  order by t.departure_date desc, t.departure_time desc
  limit 1;
end;
$$;

create or replace function public.assess_ticket_for_trip(
  p_codes text[],
  p_target_trip_id uuid
)
returns table (
  result text,
  source_trip_id uuid,
  route_label text,
  departure_date date,
  departure_time time,
  arrival_time time,
  platform text,
  seats_available integer,
  passenger_name text,
  seat_number text,
  ticket_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_codes text[];
  matched record;
  target_trip public.trips%rowtype;
  effective_capacity integer;
  occupied_count integer := 0;
  moving_count integer := 0;
begin
  if (select auth.uid()) is null
     or private.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  select array_agg(upper(btrim(code)))
  into normalized_codes
  from unnest(coalesce(p_codes, array[]::text[])) code
  where btrim(code) <> '';

  select t.* into target_trip
  from public.trips t
  where t.id = p_target_trip_id
    and t.status not in ('arrived'::public.trip_status, 'cancelled'::public.trip_status)
    and (t.driver_id = (select auth.uid()) or private.is_staff())
  for update;

  if not found then
    return query
    select 'target_unavailable', null::uuid, null::text, null::date, null::time,
      null::time, null::text, 0, null::text, null::text, null::text;
    return;
  end if;

  select
    bp.id as passenger_id,
    bp.full_name as passenger_name,
    bp.seat_number,
    bp.ticket_code,
    bp.checked_in_at,
    b.id as booking_id,
    b.trip_id as source_trip_id,
    source_trip.route_id as source_route_id,
    source_trip.departure_date,
    source_trip.departure_time,
    source_trip.arrival_time,
    source_trip.platform,
    origin.name || ' - ' || destination.name as route_label
  into matched
  from public.booking_passengers bp
  join public.bookings b on b.id = bp.booking_id
  join public.trips source_trip on source_trip.id = b.trip_id
  join public.routes r on r.id = source_trip.route_id
  join public.stations origin on origin.id = r.origin_station_id
  join public.stations destination on destination.id = r.destination_station_id
  where b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    and (
      upper(bp.ticket_code) = any(normalized_codes)
      or upper(b.booking_reference) = any(normalized_codes)
    )
  order by source_trip.departure_date desc, source_trip.departure_time desc
  limit 1;

  if not found then
    return query
    select 'not_found', null::uuid, null::text, null::date, null::time,
      null::time, null::text, 0, null::text, null::text, null::text;
    return;
  end if;

  select least(target_trip.capacity, coalesce(v.seats_total, target_trip.capacity))
  into effective_capacity
  from (values (1)) singleton(value)
  left join public.vehicles v on v.id = target_trip.vehicle_id;

  select count(*)::integer into moving_count
  from public.booking_passengers bp
  where bp.booking_id = matched.booking_id;

  select count(*)::integer into occupied_count
  from public.booking_passengers bp
  join public.bookings b on b.id = bp.booking_id
  where b.trip_id = p_target_trip_id
    and b.id <> matched.booking_id
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status);

  if matched.source_trip_id = p_target_trip_id then
    return query select
      'current_trip', matched.source_trip_id, matched.route_label, matched.departure_date,
      matched.departure_time, matched.arrival_time, matched.platform,
      greatest(effective_capacity - occupied_count - moving_count, 0),
      matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  if exists (
    select 1 from public.booking_passengers bp
    where bp.booking_id = matched.booking_id and bp.checked_in_at is not null
  ) then
    return query select
      'already_checked_in', matched.source_trip_id, matched.route_label, matched.departure_date,
      matched.departure_time, matched.arrival_time, matched.platform,
      greatest(effective_capacity - occupied_count, 0),
      matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  if matched.source_route_id <> target_trip.route_id then
    return query select
      'wrong_route', matched.source_trip_id, matched.route_label, matched.departure_date,
      matched.departure_time, matched.arrival_time, matched.platform,
      greatest(effective_capacity - occupied_count, 0),
      matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  if occupied_count + moving_count > effective_capacity then
    return query select
      'no_capacity', matched.source_trip_id, matched.route_label, matched.departure_date,
      matched.departure_time, matched.arrival_time, matched.platform,
      greatest(effective_capacity - occupied_count, 0),
      matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  if exists (
    select 1
    from public.booking_passengers moving_passenger
    join public.booking_passengers existing_passenger
      on upper(regexp_replace(btrim(existing_passenger.seat_number), '\s+', '', 'g'))
       = upper(regexp_replace(btrim(moving_passenger.seat_number), '\s+', '', 'g'))
    join public.bookings existing_booking on existing_booking.id = existing_passenger.booking_id
    where moving_passenger.booking_id = matched.booking_id
      and existing_booking.id <> matched.booking_id
      and existing_booking.trip_id = p_target_trip_id
      and existing_booking.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
  ) then
    return query select
      'seat_conflict', matched.source_trip_id, matched.route_label, matched.departure_date,
      matched.departure_time, matched.arrival_time, matched.platform,
      greatest(effective_capacity - occupied_count, 0),
      matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  return query select
    'transferable', matched.source_trip_id, matched.route_label, matched.departure_date,
    matched.departure_time, matched.arrival_time, matched.platform,
    greatest(effective_capacity - occupied_count, 0),
    matched.passenger_name, matched.seat_number, matched.ticket_code;
end;
$$;

create or replace function public.transfer_ticket_to_trip(
  p_codes text[],
  p_target_trip_id uuid
)
returns table (
  result text,
  passenger_name text,
  seat_number text,
  ticket_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_codes text[];
  matched record;
  target_trip public.trips%rowtype;
  source_route_id uuid;
  effective_capacity integer;
  occupied_count integer;
  moving_count integer;
begin
  if (select auth.uid()) is null
     or private.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  select array_agg(upper(btrim(code)))
  into normalized_codes
  from unnest(coalesce(p_codes, array[]::text[])) code
  where btrim(code) <> '';

  select
    b.id as booking_id,
    b.trip_id as source_trip_id,
    bp.full_name as passenger_name,
    bp.seat_number,
    bp.ticket_code
  into matched
  from public.booking_passengers bp
  join public.bookings b on b.id = bp.booking_id
  where b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    and (
      upper(bp.ticket_code) = any(normalized_codes)
      or upper(b.booking_reference) = any(normalized_codes)
    )
  order by b.created_at desc
  limit 1;

  if not found then
    return query select 'not_found', null::text, null::text, null::text;
    return;
  end if;

  perform 1
  from public.bookings b
  where b.id = matched.booking_id
    and b.trip_id = matched.source_trip_id
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
  for update;

  if not found then
    raise exception 'Booking changed while the transfer was being applied.' using errcode = '40001';
  end if;

  select t.* into target_trip
  from public.trips t
  where t.id = p_target_trip_id
    and t.status not in ('arrived'::public.trip_status, 'cancelled'::public.trip_status)
    and (t.driver_id = (select auth.uid()) or private.is_staff())
  for update;

  if not found then
    return query select 'target_unavailable', matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  perform 1
  from public.booking_passengers bp
  where bp.booking_id = matched.booking_id
  order by bp.id
  for update;

  if matched.source_trip_id = p_target_trip_id then
    return query select 'current_trip', matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  if exists (
    select 1 from public.booking_passengers bp
    where bp.booking_id = matched.booking_id and bp.checked_in_at is not null
  ) then
    return query select 'already_checked_in', matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  select t.route_id into source_route_id
  from public.trips t
  where t.id = matched.source_trip_id;

  if source_route_id is distinct from target_trip.route_id then
    return query select 'wrong_route', matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  select least(target_trip.capacity, coalesce(v.seats_total, target_trip.capacity))
  into effective_capacity
  from (values (1)) singleton(value)
  left join public.vehicles v on v.id = target_trip.vehicle_id;

  select count(*)::integer into moving_count
  from public.booking_passengers bp
  where bp.booking_id = matched.booking_id;

  select count(*)::integer into occupied_count
  from public.booking_passengers bp
  join public.bookings b on b.id = bp.booking_id
  where b.trip_id = p_target_trip_id
    and b.id <> matched.booking_id
    and b.status in ('pending'::public.booking_status, 'paid'::public.booking_status);

  if occupied_count + moving_count > effective_capacity then
    return query select 'no_capacity', matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  if exists (
    select 1
    from public.booking_passengers moving_passenger
    join public.booking_passengers existing_passenger
      on upper(regexp_replace(btrim(existing_passenger.seat_number), '\s+', '', 'g'))
       = upper(regexp_replace(btrim(moving_passenger.seat_number), '\s+', '', 'g'))
    join public.bookings existing_booking on existing_booking.id = existing_passenger.booking_id
    where moving_passenger.booking_id = matched.booking_id
      and existing_booking.id <> matched.booking_id
      and existing_booking.trip_id = p_target_trip_id
      and existing_booking.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
  ) then
    return query select 'seat_conflict', matched.passenger_name, matched.seat_number, matched.ticket_code;
    return;
  end if;

  update public.bookings b
  set trip_id = p_target_trip_id
  where b.id = matched.booking_id;

  update public.booking_passengers bp
  set
    check_in_status = 'manual'::public.check_in_status,
    checked_in_at = statement_timestamp(),
    checked_in_by = (select auth.uid())
  where bp.booking_id = matched.booking_id;

  insert into public.trip_events (trip_id, actor_id, event_type, payload)
  values (
    p_target_trip_id,
    (select auth.uid()),
    'ticket_transferred_same_route',
    jsonb_build_object(
      'booking_id', matched.booking_id,
      'source_trip_id', matched.source_trip_id,
      'ticket_code', matched.ticket_code
    )
  );

  return query select 'transferred', matched.passenger_name, matched.seat_number, matched.ticket_code;
end;
$$;

-- Replace the accumulated permissive policy set with a single scoped policy
-- for each role/action combination. Anonymous and authenticated policies are
-- separated on public reference tables so their role sets never overlap.
do $$
declare
  target_table text;
  policy_name text;
begin
  foreach target_table in array array[
    'profiles', 'stations', 'routes', 'route_stops', 'vehicles', 'trips',
    'bookings', 'booking_extras', 'booking_passengers', 'payments',
    'trip_incidents', 'trip_events', 'contbus_stops', 'contbus_routes',
    'contbus_route_stops', 'contbus_departures', 'contbus_fares'
  ] loop
    execute format('alter table public.%I enable row level security', target_table);
    for policy_name in
      select p.policyname
      from pg_catalog.pg_policies p
      where p.schemaname = 'public'
        and p.tablename = target_table
    loop
      execute format('drop policy %I on public.%I', policy_name, target_table);
    end loop;
  end loop;
end
$$;

create policy profiles_authenticated_select
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_staff())
);

create policy profiles_self_insert
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

create policy profiles_self_update
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy stations_anon_select
on public.stations
for select
to anon
using (active);

create policy stations_authenticated_select
on public.stations
for select
to authenticated
using (active or (select private.is_staff()));

create policy routes_anon_select
on public.routes
for select
to anon
using (active);

create policy routes_authenticated_select
on public.routes
for select
to authenticated
using (active or (select private.is_staff()));

create policy route_stops_anon_select
on public.route_stops
for select
to anon
using (
  exists (
    select 1 from public.routes r where r.id = route_id and r.active
  )
);

create policy route_stops_authenticated_select
on public.route_stops
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1 from public.routes r where r.id = route_id and r.active
  )
);

create policy vehicles_operational_select
on public.vehicles
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.trips t
    where t.vehicle_id = id
      and t.driver_id = (select auth.uid())
  )
);

create policy trips_operational_select
on public.trips
for select
to authenticated
using (
  driver_id = (select auth.uid())
  or (select private.is_staff())
);

create policy bookings_scoped_select
on public.bookings
for select
to authenticated
using (
  customer_id = (select auth.uid())
  or (select private.is_staff())
  or (
    status in ('pending'::public.booking_status, 'paid'::public.booking_status)
    and exists (
      select 1
      from public.trips t
      where t.id = trip_id
        and t.driver_id = (select auth.uid())
    )
  )
);

create policy booking_extras_scoped_select
on public.booking_extras
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.bookings b
    left join public.trips t on t.id = b.trip_id
    where b.id = booking_id
      and (
        b.customer_id = (select auth.uid())
        or (
          b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
          and t.driver_id = (select auth.uid())
        )
      )
  )
);

create policy booking_passengers_scoped_select
on public.booking_passengers
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.bookings b
    left join public.trips t on t.id = b.trip_id
    where b.id = booking_id
      and (
        b.customer_id = (select auth.uid())
        or (
          b.status in ('pending'::public.booking_status, 'paid'::public.booking_status)
          and t.driver_id = (select auth.uid())
        )
      )
  )
);

create policy payments_scoped_select
on public.payments
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.customer_id = (select auth.uid())
  )
);

create policy trip_incidents_operational_select
on public.trip_incidents
for select
to authenticated
using (
  (select private.is_staff())
  or driver_id = (select auth.uid())
  or exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and t.driver_id = (select auth.uid())
  )
);

create policy trip_events_operational_select
on public.trip_events
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.trips t
    where t.id = trip_id
      and t.driver_id = (select auth.uid())
  )
);

create policy contbus_stops_staff_select
on public.contbus_stops
for select
to authenticated
using ((select private.is_staff()));

create policy contbus_routes_staff_select
on public.contbus_routes
for select
to authenticated
using ((select private.is_staff()));

create policy contbus_route_stops_staff_select
on public.contbus_route_stops
for select
to authenticated
using ((select private.is_staff()));

create policy contbus_departures_staff_select
on public.contbus_departures
for select
to authenticated
using ((select private.is_staff()));

create policy contbus_fares_staff_select
on public.contbus_fares
for select
to authenticated
using ((select private.is_staff()));

-- Remove legacy broad ACLs before granting the exact read/write surface used
-- by the web clients. RLS remains an additional row-level boundary.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

grant select (id, code, name, city) on public.stations to anon;
grant select (
  id, code, origin_station_id, destination_station_id, duration_minutes, base_price, active
) on public.routes to anon;

grant select (id, role, full_name, phone, created_at) on public.profiles to authenticated;
grant insert (id, full_name, phone) on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

grant select (id, code, name, city, address, active) on public.stations to authenticated;
grant select (
  id, code, origin_station_id, destination_station_id, duration_minutes, base_price, active
) on public.routes to authenticated;
grant select (route_id, station_id, stop_order, offset_minutes) on public.route_stops to authenticated;
grant select (id, label, plate_number, seats_total, active) on public.vehicles to authenticated;
grant select (
  id, route_id, departure_date, departure_time, arrival_time, status,
  driver_id, vehicle_id, platform, capacity, price
) on public.trips to authenticated;
grant select (
  id, booking_reference, customer_id, trip_id, buyer_name, buyer_email,
  buyer_phone, passenger_count, status, total_amount, currency, created_at
) on public.bookings to authenticated;
grant select (
  id, booking_id, full_name, seat_number, ticket_code, check_in_status,
  checked_in_at, checked_in_by, created_at
) on public.booking_passengers to authenticated;
grant select (
  id, booking_id, provider, provider_reference, status, amount, currency, created_at
) on public.payments to authenticated;
grant select (id, trip_id, driver_id, severity, note, created_at)
  on public.trip_incidents to authenticated;
grant select (id, trip_id, actor_id, event_type, payload, created_at)
  on public.trip_events to authenticated;

-- PostgreSQL grants EXECUTE to PUBLIC on new functions by default. Start from
-- zero and allowlist only the RPC entry points used by the application.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all privileges on all functions in schema private from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_assigned_driver(uuid) to authenticated;

grant execute on function public.public_trip_schedule(date) to anon, authenticated;
grant execute on function public.create_public_booking_with_seats(
  uuid, text, text, text, integer, text[], boolean, boolean, text
) to anon, authenticated;
grant execute on function public.lookup_public_booking(text, text) to anon, authenticated;
grant execute on function public.cancel_public_booking(text, text) to anon, authenticated;

grant execute on function public.customer_booking_history() to authenticated;
grant execute on function public.driver_assigned_trips(date) to authenticated;
grant execute on function public.update_assigned_trip_status(uuid, public.trip_status) to authenticated;
grant execute on function public.set_assigned_passenger_check_in(uuid, boolean) to authenticated;
grant execute on function public.report_assigned_trip_incident(uuid, text, text) to authenticated;
grant execute on function public.set_profile_role(uuid, public.app_role) to authenticated;
grant execute on function public.update_staff_trip(uuid, jsonb) to authenticated;
grant execute on function public.update_staff_booking_status(uuid, public.booking_status) to authenticated;
grant execute on function public.staff_schedule_overview() to authenticated;
grant execute on function public.create_contbus_departure(
  uuid, time, text, integer[], text, boolean, text
) to authenticated;
grant execute on function public.update_contbus_departure(uuid, jsonb) to authenticated;
grant execute on function public.delete_contbus_departure(uuid) to authenticated;
grant execute on function public.update_contbus_stop(uuid, jsonb) to authenticated;
grant execute on function public.update_contbus_fare_price(uuid, numeric) to authenticated;
grant execute on function public.generate_contbus_trips(date, date) to authenticated;
grant execute on function public.dispatcher_dashboard_overview(date) to authenticated;
grant execute on function public.lookup_ticket_trip(text[]) to authenticated;
grant execute on function public.assess_ticket_for_trip(text[], uuid) to authenticated;
grant execute on function public.transfer_ticket_to_trip(text[], uuid) to authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
