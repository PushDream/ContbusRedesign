-- Seed data for the Contbus schedule tables, scraped from the live contbus.pl
-- timetable and cennik (price list) on 2026-08-12. Safe to re-run: fixed UUIDs
-- + ON CONFLICT upserts, and only touches the contbus_* tables (never trips,
-- bookings, stations, or routes used by the live booking flow).

-- ---------------------------------------------------------------------------
-- Stops (route order, Lublin -> Warsaw direction)
-- ---------------------------------------------------------------------------
insert into public.contbus_stops (id, name, city, address, stop_order)
values
  ('a1000000-0000-4000-8000-000000000001', 'Lublin Dworzec', 'Lublin', 'ul. Dworcowa 2', 1),
  ('a1000000-0000-4000-8000-000000000002', 'Lublin PKS', 'Lublin', 'al. Tysiąclecia / Dworzec Główny PKS 04', 2),
  ('a1000000-0000-4000-8000-000000000003', 'Lotnisko Chopina', 'Warszawa', 'Lotnisko Chopina w Warszawie', 3),
  ('a1000000-0000-4000-8000-000000000004', 'Warszawa Centrum', 'Warszawa', 'ul. T. Chałubińskiego (przystanek Marriott)', 4),
  ('a1000000-0000-4000-8000-000000000005', 'Lotnisko Modlin', 'Nowy Dwór Mazowiecki', 'Port Lotniczy Modlin', 5)
on conflict (id) do update set
  name = excluded.name,
  city = excluded.city,
  address = excluded.address,
  stop_order = excluded.stop_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Route
-- ---------------------------------------------------------------------------
insert into public.contbus_routes (id, name, is_active)
values ('b2000000-0000-4000-8000-000000000001', 'Lublin–Warszawa–Modlin', true)
on conflict (id) do update set
  name = excluded.name,
  is_active = excluded.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Route stops (arrival offsets estimated from the ~2h30m Lublin -> Warszawa
-- Centrum running time and the published fare durations)
-- ---------------------------------------------------------------------------
insert into public.contbus_route_stops (route_id, stop_id, stop_order, arrival_offset_minutes)
values
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 1, 0),
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 2, 10),
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 3, 145),
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 4, 155),
  ('b2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 5, 215)
on conflict (route_id, stop_order) do update set
  stop_id = excluded.stop_id,
  arrival_offset_minutes = excluded.arrival_offset_minutes;

-- ---------------------------------------------------------------------------
-- Departures
-- ---------------------------------------------------------------------------
delete from public.contbus_departures where route_id = 'b2000000-0000-4000-8000-000000000001';

insert into public.contbus_departures (route_id, departure_time, direction, days_of_week, trip_type, is_active)
select
  'b2000000-0000-4000-8000-000000000001',
  departure_time::time,
  'lublin_warszawa',
  '{1,2,3,4,5,6,7}',
  'regular',
  true
from unnest(array[
  '04:35', '05:05', '05:35', '06:20', '06:40', '06:50', '07:35', '08:00', '08:20', '08:35',
  '09:05', '09:35', '10:05', '10:35', '11:05', '11:35', '12:05', '12:35', '13:05', '13:35',
  '14:05', '14:30', '14:45', '16:20', '16:55'
]) as departure_time;

insert into public.contbus_departures (route_id, departure_time, direction, days_of_week, trip_type, is_active)
select
  'b2000000-0000-4000-8000-000000000001',
  departure_time::time,
  'warszawa_lublin',
  '{1,2,3,4,5,6,7}',
  'regular',
  true
from unnest(array[
  '08:00', '09:00', '10:00', '10:45', '11:00', '12:00', '12:30', '13:00', '13:30', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:30', '21:30', '23:00'
]) as departure_time;

-- ---------------------------------------------------------------------------
-- Fares (PLN, from the official cennik). Bidirectional/"either stop" price
-- lines are expanded into explicit directed origin -> destination rows.
-- ---------------------------------------------------------------------------
insert into public.contbus_fares (origin_stop_id, destination_stop_id, price_pln)
values
  -- Lublin Dworzec
  ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004', 50), -- Lublin Dworzec -> Warszawa Centrum
  ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 60), -- Lublin Dworzec -> Lotnisko Chopina
  ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 70), -- Lublin Dworzec -> Lotnisko Modlin
  -- Lublin PKS
  ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000004', 50), -- Lublin PKS -> Warszawa Centrum
  ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000003', 60), -- Lublin PKS -> Lotnisko Chopina
  ('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005', 70), -- Lublin PKS -> Lotnisko Modlin
  -- Warszawa Centrum <-> Lotnisko Chopina
  ('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003', 30),
  ('a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004', 30),
  -- Warszawa Centrum <-> Lotnisko Modlin
  ('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005', 40),
  ('a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000004', 40),
  -- Lotnisko Chopina <-> Lotnisko Modlin
  ('a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000005', 50),
  ('a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000003', 50),
  -- Lotnisko Modlin -> Lublin (either stop)
  ('a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 70),
  ('a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000002', 70),
  -- Warszawa Centrum -> Lublin (either stop)
  ('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 50),
  ('a1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000002', 50),
  -- Lotnisko Chopina -> Lublin (either stop)
  ('a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 60),
  ('a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', 60)
on conflict (origin_stop_id, destination_stop_id) do update set
  price_pln = excluded.price_pln,
  updated_at = now();
