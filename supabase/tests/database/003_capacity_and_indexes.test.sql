begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(11);

insert into public.stations (id, code, name, city, active)
values
  ('61000000-0000-4000-8000-000000000001', 'DB-CAP-ORIGIN', 'Capacity Test Origin', 'Test City', true),
  ('61000000-0000-4000-8000-000000000002', 'DB-CAP-DEST', 'Capacity Test Destination', 'Test City', true);

insert into public.routes (
  id,
  code,
  origin_station_id,
  destination_station_id,
  duration_minutes,
  base_price,
  active
)
values (
  '62000000-0000-4000-8000-000000000001',
  'DB-CAP-ROUTE',
  '61000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000002',
  60,
  25,
  true
);

insert into public.vehicles (id, plate_number, label, seats_total, active)
values (
  '63000000-0000-4000-8000-000000000001',
  'DB-CAP-01',
  'Capacity Test Vehicle',
  2,
  true
);

insert into public.trips (
  id,
  route_id,
  departure_date,
  departure_time,
  arrival_time,
  status,
  vehicle_id,
  capacity,
  price
)
values
  (
    '64000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    '2099-02-15',
    '08:00',
    '09:00',
    'scheduled',
    '63000000-0000-4000-8000-000000000001',
    2,
    25
  ),
  (
    '64000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000001',
    '2099-02-15',
    '10:00',
    '11:00',
    'scheduled',
    '63000000-0000-4000-8000-000000000001',
    2,
    25
  );

insert into public.bookings (
  id,
  booking_reference,
  trip_id,
  buyer_name,
  buyer_email,
  passenger_count,
  status,
  total_amount,
  currency
)
values
  (
    '65000000-0000-4000-8000-000000000001',
    'DB-CAP-BOOKING-1',
    '64000000-0000-4000-8000-000000000001',
    'Capacity Passenger One',
    'capacity-one@contbus.invalid',
    1,
    'paid',
    25,
    'PLN'
  ),
  (
    '65000000-0000-4000-8000-000000000002',
    'DB-CAP-BOOKING-2',
    '64000000-0000-4000-8000-000000000001',
    'Capacity Passenger Two',
    'capacity-two@contbus.invalid',
    1,
    'paid',
    25,
    'PLN'
  ),
  (
    '65000000-0000-4000-8000-000000000003',
    'DB-CAP-CANCELLED',
    '64000000-0000-4000-8000-000000000001',
    'Cancelled Capacity Passenger',
    'capacity-cancelled@contbus.invalid',
    1,
    'cancelled',
    25,
    'PLN'
  ),
  (
    '65000000-0000-4000-8000-000000000004',
    'DB-CAP-TRANSFER',
    '64000000-0000-4000-8000-000000000002',
    'Transfer Capacity Passenger',
    'capacity-transfer@contbus.invalid',
    1,
    'paid',
    25,
    'PLN'
  );

insert into public.booking_passengers (
  id,
  booking_id,
  full_name,
  seat_number,
  ticket_code
)
values
  (
    '66000000-0000-4000-8000-000000000001',
    '65000000-0000-4000-8000-000000000001',
    'Capacity Passenger One',
    '1A',
    'DB-CAP-TICKET-1'
  ),
  (
    '66000000-0000-4000-8000-000000000002',
    '65000000-0000-4000-8000-000000000002',
    'Capacity Passenger Two',
    '2A',
    'DB-CAP-TICKET-2'
  ),
  (
    '66000000-0000-4000-8000-000000000003',
    '65000000-0000-4000-8000-000000000003',
    'Cancelled Capacity Passenger',
    '3A',
    'DB-CAP-TICKET-3'
  ),
  (
    '66000000-0000-4000-8000-000000000004',
    '65000000-0000-4000-8000-000000000004',
    'Transfer Capacity Passenger',
    '1A',
    'DB-CAP-TICKET-4'
  );

-- The booking row is allowed to exist while its passenger rows are assembled in
-- the same transaction. The actual over-capacity passenger must be rejected.
insert into public.bookings (
  id,
  booking_reference,
  trip_id,
  buyer_name,
  buyer_email,
  passenger_count,
  status,
  total_amount,
  currency
)
values (
  '65000000-0000-4000-8000-000000000005',
  'DB-CAP-OVERFLOW',
  '64000000-0000-4000-8000-000000000001',
  'Overflow Passenger',
  'capacity-overflow@contbus.invalid',
  1,
  'paid',
  25,
  'PLN'
);

select throws_ok(
  $$
    insert into public.trips (
      id,
      route_id,
      departure_date,
      departure_time,
      arrival_time,
      status,
      vehicle_id,
      capacity,
      price
    )
    values (
      '64000000-0000-4000-8000-000000000003',
      '62000000-0000-4000-8000-000000000001',
      '2099-02-15',
      '12:00',
      '13:00',
      'scheduled',
      '63000000-0000-4000-8000-000000000001',
      3,
      25
    )
  $$,
  null,
  null,
  'a trip cannot be created above its assigned vehicle seat count'
);

select throws_ok(
  $$
    update public.trips
    set capacity = 3
    where id = '64000000-0000-4000-8000-000000000001'
  $$,
  null,
  null,
  'a trip capacity cannot be raised above its assigned vehicle seat count'
);

select throws_ok(
  $$
    update public.vehicles
    set seats_total = 1
    where id = '63000000-0000-4000-8000-000000000001'
  $$,
  null,
  null,
  'vehicle seats cannot be lowered below the capacity of assigned trips'
);

select throws_ok(
  $$
    insert into public.booking_passengers (
      id,
      booking_id,
      full_name,
      seat_number,
      ticket_code
    )
    values (
      '66000000-0000-4000-8000-000000000005',
      '65000000-0000-4000-8000-000000000005',
      'Overflow Passenger',
      '4A',
      'DB-CAP-TICKET-5'
    )
  $$,
  null,
  null,
  'an active booking cannot exceed trip or vehicle capacity'
);

-- Remove the deliberately incomplete booking so its deferred passenger-count
-- check cannot mask the capacity assertion above.
delete from public.bookings
where id = '65000000-0000-4000-8000-000000000005';

select throws_ok(
  $$
    update public.bookings
    set status = 'paid'
    where id = '65000000-0000-4000-8000-000000000003'
  $$,
  null,
  null,
  'reactivating a cancelled booking cannot overfill a trip'
);

select throws_ok(
  $$
    update public.bookings
    set trip_id = '64000000-0000-4000-8000-000000000001'
    where id = '65000000-0000-4000-8000-000000000004'
  $$,
  null,
  null,
  'transferring a booking cannot overfill the destination trip'
);

select throws_ok(
  $$
    update public.booking_passengers
    set seat_number = '1A'
    where id = '66000000-0000-4000-8000-000000000002'
  $$,
  null,
  null,
  'active passengers on the same trip cannot share a seat'
);

select is(
  (
    select sum(passenger_count)::bigint
    from public.bookings
    where trip_id = '64000000-0000-4000-8000-000000000001'
      and status in ('pending', 'paid')
  ),
  2::bigint,
  'failed insert, reactivation, and transfer attempts leave occupancy unchanged'
);

select ok(
  coalesce(
    position(
      'for update' in lower(
        pg_get_functiondef(
          to_regprocedure('public.create_public_booking_with_seats(uuid,text,text,text,integer,text[],boolean,boolean,text)')
        )
      )
    ) > 0
    and position(
      'for update' in lower(
        pg_get_functiondef(to_regprocedure('private.enforce_passenger_capacity()'))
      )
    ) > 0
    and position(
      'for update' in lower(
        pg_get_functiondef(to_regprocedure('private.enforce_booking_move_capacity()'))
      )
    ) > 0,
    false
  ),
  'booking, passenger, and transfer capacity paths serialize on the trip row'
);

select is_empty(
  $$
    with required(table_name, column_name) as (
      values
        ('booking_passengers', 'checked_in_by'),
        ('contbus_route_stops', 'stop_id'),
        ('route_stops', 'station_id'),
        ('routes', 'destination_station_id'),
        ('trip_events', 'actor_id'),
        ('trip_events', 'trip_id'),
        ('trip_incidents', 'driver_id'),
        ('trip_incidents', 'trip_id'),
        ('trips', 'vehicle_id')
    )
    select required.table_name || '.' || required.column_name
    from required
    where not exists (
      select 1
      from pg_namespace n
      join pg_class table_class
        on table_class.relnamespace = n.oid
      join pg_attribute column_attribute
        on column_attribute.attrelid = table_class.oid
      join pg_index index_catalog
        on index_catalog.indrelid = table_class.oid
      where n.nspname = 'public'
        and table_class.relname = required.table_name
        and column_attribute.attname = required.column_name
        and column_attribute.attnum = index_catalog.indkey[0]
        and index_catalog.indisvalid
        and index_catalog.indisready
        and index_catalog.indpred is null
    )
  $$,
  'every required foreign-key column has a usable leading-column index'
);

select is_empty(
  $$
    select
      table_class.relname || ': ' || first_index.relname || ' = ' || second_index.relname
    from pg_index first_catalog
    join pg_index second_catalog
      on second_catalog.indrelid = first_catalog.indrelid
     and second_catalog.indexrelid > first_catalog.indexrelid
     and second_catalog.indkey = first_catalog.indkey
     and second_catalog.indclass = first_catalog.indclass
     and second_catalog.indcollation = first_catalog.indcollation
     and second_catalog.indoption = first_catalog.indoption
     and second_catalog.indnkeyatts = first_catalog.indnkeyatts
     and second_catalog.indisunique = first_catalog.indisunique
     and second_catalog.indnullsnotdistinct = first_catalog.indnullsnotdistinct
     and second_catalog.indisexclusion = first_catalog.indisexclusion
     and coalesce(second_catalog.indexprs::text, '') = coalesce(first_catalog.indexprs::text, '')
     and coalesce(second_catalog.indpred::text, '') = coalesce(first_catalog.indpred::text, '')
    join pg_class table_class
      on table_class.oid = first_catalog.indrelid
    join pg_namespace table_namespace
      on table_namespace.oid = table_class.relnamespace
    join pg_class first_index
      on first_index.oid = first_catalog.indexrelid
    join pg_class second_index
      on second_index.oid = second_catalog.indexrelid
     and second_index.relam = first_index.relam
    where table_namespace.nspname = 'public'
      and first_catalog.indisvalid
      and second_catalog.indisvalid
  $$,
  'the public schema contains no structurally duplicate indexes'
);

select * from finish();
rollback;
