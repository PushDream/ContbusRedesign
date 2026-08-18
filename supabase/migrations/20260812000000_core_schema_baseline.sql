-- Reproducible baseline for the core booking/operations schema that pre-dated
-- the checked-in Contbus schedule migrations. The production objects already
-- existed when this repository adopted migrations; production history is
-- repaired separately without replaying this file.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace) then
    create type public.app_role as enum ('customer', 'driver', 'dispatcher', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'station_kind' and typnamespace = 'public'::regnamespace) then
    create type public.station_kind as enum ('city', 'airport');
  end if;
  if not exists (select 1 from pg_type where typname = 'trip_status' and typnamespace = 'public'::regnamespace) then
    create type public.trip_status as enum ('scheduled', 'boarding', 'departed', 'delayed', 'arrived', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'booking_status' and typnamespace = 'public'::regnamespace) then
    create type public.booking_status as enum ('pending', 'paid', 'cancelled', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'check_in_status' and typnamespace = 'public'::regnamespace) then
    create type public.check_in_status as enum ('pending', 'boarded', 'manual', 'no_show');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status' and typnamespace = 'public'::regnamespace) then
    create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stations (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text not null,
  address text,
  kind public.station_kind not null default 'city',
  latitude numeric,
  longitude numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null,
  origin_station_id uuid not null references public.stations(id),
  destination_station_id uuid not null references public.stations(id),
  duration_minutes integer not null check (duration_minutes > 0),
  base_price numeric not null check (base_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_code_key unique (code),
  constraint routes_unique_pair unique (origin_station_id, destination_station_id),
  constraint routes_distinct_stations check (origin_station_id <> destination_station_id)
);

create table if not exists public.route_stops (
  id uuid primary key default extensions.gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  station_id uuid not null references public.stations(id),
  stop_order integer not null check (stop_order >= 0),
  offset_minutes integer not null default 0 check (offset_minutes >= 0),
  created_at timestamptz not null default now(),
  constraint route_stops_unique_order unique (route_id, stop_order),
  constraint route_stops_unique_station unique (route_id, station_id)
);

create table if not exists public.vehicles (
  id uuid primary key default extensions.gen_random_uuid(),
  plate_number text not null unique,
  label text not null,
  seats_total integer not null default 22 check (seats_total > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default extensions.gen_random_uuid(),
  route_id uuid not null references public.routes(id),
  departure_date date not null,
  departure_time time not null,
  arrival_time time not null,
  status public.trip_status not null default 'scheduled',
  driver_id uuid references public.profiles(id),
  vehicle_id uuid references public.vehicles(id),
  platform text,
  capacity integer not null default 22 check (capacity > 0),
  price numeric not null check (price >= 0),
  live_latitude numeric,
  live_longitude numeric,
  live_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_unique_departure unique (route_id, departure_date, departure_time)
);

create table if not exists public.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_reference text not null unique,
  customer_id uuid references public.profiles(id),
  trip_id uuid not null references public.trips(id),
  buyer_name text not null,
  buyer_email extensions.citext not null,
  buyer_phone text,
  passenger_count integer not null check (passenger_count > 0),
  status public.booking_status not null default 'pending',
  total_amount numeric not null check (total_amount >= 0),
  currency text not null default 'PLN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_extras (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  luggage_count integer not null default 0 check (luggage_count >= 0),
  insurance boolean not null default false,
  priority_boarding boolean not null default false,
  amount numeric not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.booking_passengers (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  full_name text not null,
  seat_number text not null,
  ticket_code text not null unique,
  check_in_status public.check_in_status not null default 'pending',
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_passengers_unique_seat unique (booking_id, seat_number)
);

create table if not exists public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  provider text not null,
  provider_reference text,
  status public.payment_status not null default 'pending',
  amount numeric not null check (amount >= 0),
  currency text not null default 'PLN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_incidents (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid not null references public.profiles(id),
  severity text not null default 'info',
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_events (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bookings_customer_idx on public.bookings(customer_id);
create index if not exists bookings_trip_idx on public.bookings(trip_id);
create index if not exists booking_passengers_booking_idx on public.booking_passengers(booking_id);
create index if not exists trips_driver_idx on public.trips(driver_id);

alter table public.profiles enable row level security;
alter table public.stations enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_extras enable row level security;
alter table public.booking_passengers enable row level security;
alter table public.payments enable row level security;
alter table public.trip_incidents enable row level security;
alter table public.trip_events enable row level security;
