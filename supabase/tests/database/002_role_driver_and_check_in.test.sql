begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(25);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'db-test-admin@contbus.invalid', '{}'::jsonb),
  ('d1111111-1111-4111-8111-111111111111', 'db-test-driver@contbus.invalid', '{}'::jsonb),
  ('d2222222-2222-4222-8222-222222222222', 'db-test-other-driver@contbus.invalid', '{}'::jsonb),
  ('c1111111-1111-4111-8111-111111111111', 'db-test-customer@contbus.invalid', '{}'::jsonb);

insert into public.profiles (id, role, full_name)
values
  ('a1111111-1111-4111-8111-111111111111', 'admin', 'Database Test Admin'),
  ('d1111111-1111-4111-8111-111111111111', 'driver', 'Database Test Driver'),
  ('d2222222-2222-4222-8222-222222222222', 'driver', 'Database Test Other Driver'),
  ('c1111111-1111-4111-8111-111111111111', 'customer', 'Database Test Customer')
on conflict (id) do update
set role = excluded.role,
    full_name = excluded.full_name;

insert into public.stations (id, code, name, city, active)
values
  ('51000000-0000-4000-8000-000000000001', 'DB-TEST-ORIGIN', 'Database Test Origin', 'Test City', true),
  ('51000000-0000-4000-8000-000000000002', 'DB-TEST-DEST', 'Database Test Destination', 'Test City', true);

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
  '52000000-0000-4000-8000-000000000001',
  'DB-TEST-ROUTE',
  '51000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000002',
  60,
  25,
  true
);

insert into public.vehicles (id, plate_number, label, seats_total, active)
values (
  '53000000-0000-4000-8000-000000000001',
  'DB-TEST-01',
  'Database Test Vehicle',
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
  driver_id,
  vehicle_id,
  platform,
  capacity,
  price
)
values
  (
    '54000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    '2099-01-15',
    '08:00',
    '09:00',
    'scheduled',
    'd1111111-1111-4111-8111-111111111111',
    '53000000-0000-4000-8000-000000000001',
    'T1',
    2,
    25
  ),
  (
    '54000000-0000-4000-8000-000000000002',
    '52000000-0000-4000-8000-000000000001',
    '2099-01-15',
    '10:00',
    '11:00',
    'scheduled',
    'd2222222-2222-4222-8222-222222222222',
    '53000000-0000-4000-8000-000000000001',
    'T2',
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
    '55000000-0000-4000-8000-000000000001',
    'DB-TEST-BOOKING-1',
    '54000000-0000-4000-8000-000000000001',
    'Assigned Passenger',
    'assigned-passenger@contbus.invalid',
    1,
    'paid',
    25,
    'PLN'
  ),
  (
    '55000000-0000-4000-8000-000000000002',
    'DB-TEST-BOOKING-2',
    '54000000-0000-4000-8000-000000000002',
    'Other Passenger',
    'other-passenger@contbus.invalid',
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
    '56000000-0000-4000-8000-000000000001',
    '55000000-0000-4000-8000-000000000001',
    'Assigned Passenger',
    '1A',
    'DB-TEST-TICKET-1'
  ),
  (
    '56000000-0000-4000-8000-000000000002',
    '55000000-0000-4000-8000-000000000002',
    'Other Passenger',
    '1A',
    'DB-TEST-TICKET-2'
  );

set local role anon;

select throws_ok(
  $$select id from public.trips where departure_date = '2099-01-15'$$,
  '42501',
  null,
  'anonymous callers cannot read trips directly'
);

select results_eq(
  $$select count(*) from public.public_trip_schedule('2099-01-15')$$,
  array[2::bigint],
  'anonymous callers can read the two fixtures through the narrow schedule RPC'
);

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = 'd1111111-1111-4111-8111-111111111111';

select throws_ok(
  $$
    update public.profiles
    set role = 'admin'
    where id = 'd1111111-1111-4111-8111-111111111111'
  $$,
  '42501',
  null,
  'a driver cannot escalate a profile role with a direct update'
);

select lives_ok(
  $$
    update public.profiles
    set full_name = 'Updated Driver Name'
    where id = 'd1111111-1111-4111-8111-111111111111'
  $$,
  'a signed-in user can update the allowed fields on their own profile'
);

select throws_ok(
  $$
    select public.set_profile_role(
      'c1111111-1111-4111-8111-111111111111',
      'dispatcher'
    )
  $$,
  '42501',
  null,
  'a non-administrator cannot use the role-change RPC'
);

set local request.jwt.claim.sub = 'a1111111-1111-4111-8111-111111111111';

select lives_ok(
  $$
    select public.set_profile_role(
      'c1111111-1111-4111-8111-111111111111',
      'dispatcher'
    )
  $$,
  'an administrator can use the role-change RPC'
);

select is(
  (
    select role::text
    from public.profiles
    where id = 'c1111111-1111-4111-8111-111111111111'
  ),
  'dispatcher',
  'the administrator role change is applied'
);

select results_eq(
  $$select count(*) from public.trips where departure_date = '2099-01-15'$$,
  array[2::bigint],
  'administrators retain the full operational trip read flow'
);

select lives_ok(
  $$
    select
      (select count(*) from public.stations)
      + (select count(*) from public.routes)
      + (select count(*) from public.trips)
      + (select count(*) from public.vehicles)
      + (select count(*) from public.profiles)
      + (select count(*) from public.bookings)
      + (select count(*) from public.booking_passengers)
      + (select count(*) from public.payments)
      + (select count(*) from public.trip_incidents)
      + (select count(*) from public.trip_events)
  $$,
  'administrators retain read access to the operational dashboard tables'
);

set local request.jwt.claim.sub = 'd1111111-1111-4111-8111-111111111111';

select results_eq(
  $$select count(*) from public.vehicles where id = '53000000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'vehicle RLS exposes the vehicle assigned to the driver trip'
);

select results_eq(
  $$select count(*) from public.driver_assigned_trips('2099-01-15')$$,
  array[1::bigint],
  'a driver sees only one assigned trip on the fixture date'
);

select results_eq(
  $$select count(*) from public.trips where departure_date = '2099-01-15'$$,
  array[1::bigint],
  'trip RLS limits a driver direct read to the caller assigned trip'
);

select results_eq(
  $$
    select count(*)
    from public.bookings
    where id in (
      '55000000-0000-4000-8000-000000000001',
      '55000000-0000-4000-8000-000000000002'
    )
  $$,
  array[1::bigint],
  'booking RLS limits a driver manifest read to assigned trips'
);

select results_eq(
  $$
    select count(*)
    from public.booking_passengers
    where id in (
      '56000000-0000-4000-8000-000000000001',
      '56000000-0000-4000-8000-000000000002'
    )
  $$,
  array[1::bigint],
  'passenger RLS limits a driver manifest read to assigned trips'
);

select results_eq(
  $$select id from public.driver_assigned_trips('2099-01-15')$$,
  array['54000000-0000-4000-8000-000000000001'::uuid],
  'the driver-assignment RPC returns only the caller assigned trip'
);

select ok(
  public.update_assigned_trip_status(
    '54000000-0000-4000-8000-000000000001',
    'boarding'
  ),
  'a driver can perform a permitted status action on an assigned trip'
);

select is(
  (
    select status::text
    from public.trips
    where id = '54000000-0000-4000-8000-000000000001'
  ),
  'boarding',
  'the permitted assigned-trip status action is persisted'
);

select ok(
  not public.update_assigned_trip_status(
    '54000000-0000-4000-8000-000000000002',
    'boarding'
  ),
  'a driver cannot update another driver trip'
);

select throws_ok(
  $$
    select public.update_assigned_trip_status(
      '54000000-0000-4000-8000-000000000001',
      'cancelled'
    )
  $$,
  '22023',
  null,
  'a driver cannot perform an unsupported cancellation action'
);

select ok(
  public.set_assigned_passenger_check_in(
    '56000000-0000-4000-8000-000000000001',
    true
  ),
  'a driver can check in a passenger on an assigned trip'
);

select ok(
  (
    select
      check_in_status = 'boarded'
      and checked_in_at is not null
      and checked_in_by = 'd1111111-1111-4111-8111-111111111111'
    from public.booking_passengers
    where id = '56000000-0000-4000-8000-000000000001'
  ),
  'check-in status, timestamp, and actor are recorded atomically'
);

select throws_ok(
  $$
    select public.set_assigned_passenger_check_in(
      '56000000-0000-4000-8000-000000000002',
      true
    )
  $$,
  '42501',
  null,
  'a driver cannot check in a passenger on another driver trip'
);

select ok(
  public.set_assigned_passenger_check_in(
    '56000000-0000-4000-8000-000000000001',
    false
  ),
  'a driver can undo a check-in on an assigned trip'
);

select ok(
  (
    select
      check_in_status = 'pending'
      and checked_in_at is null
      and checked_in_by is null
    from public.booking_passengers
    where id = '56000000-0000-4000-8000-000000000001'
  ),
  'undoing check-in resets status, timestamp, and actor together'
);

set local role postgres;

select throws_ok(
  $$
    update public.booking_passengers
    set check_in_status = 'boarded',
        checked_in_at = null,
        checked_in_by = null
    where id = '56000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  null,
  'the database rejects a check-in status without its timestamp and actor'
);

select * from finish();
rollback;
