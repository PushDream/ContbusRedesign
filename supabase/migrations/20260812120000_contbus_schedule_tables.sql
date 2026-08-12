-- Contbus schedule management tables: stops, routes, route stops, departures, fares.
-- Additive only - does not touch the existing stations/routes/trips/bookings tables
-- used by the live booking flow. RLS mirrors the existing pattern in this project:
-- public read access, writes restricted to profiles with role = 'admin'.

create extension if not exists pgcrypto;

create table if not exists public.contbus_stops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  address text,
  lat numeric,
  lng numeric,
  stop_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contbus_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  permit_number text,
  valid_from date,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contbus_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.contbus_routes(id) on delete cascade,
  stop_id uuid not null references public.contbus_stops(id) on delete cascade,
  stop_order integer not null,
  arrival_offset_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  unique (route_id, stop_order),
  unique (route_id, stop_id)
);

create table if not exists public.contbus_departures (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.contbus_routes(id) on delete cascade,
  departure_time time not null,
  direction text not null check (direction in ('lublin_warszawa', 'warszawa_lublin')),
  days_of_week integer[] not null default '{1,2,3,4,5,6,7}',
  trip_type text not null default 'regular' check (trip_type in ('regular', 'express')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contbus_fares (
  id uuid primary key default gen_random_uuid(),
  origin_stop_id uuid not null references public.contbus_stops(id) on delete cascade,
  destination_stop_id uuid not null references public.contbus_stops(id) on delete cascade,
  price_pln numeric(6, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origin_stop_id, destination_stop_id),
  check (origin_stop_id <> destination_stop_id)
);

create index if not exists contbus_route_stops_route_id_idx on public.contbus_route_stops(route_id);
create index if not exists contbus_departures_route_id_idx on public.contbus_departures(route_id);
create index if not exists contbus_fares_origin_idx on public.contbus_fares(origin_stop_id);
create index if not exists contbus_fares_destination_idx on public.contbus_fares(destination_stop_id);

alter table public.contbus_stops enable row level security;
alter table public.contbus_routes enable row level security;
alter table public.contbus_route_stops enable row level security;
alter table public.contbus_departures enable row level security;
alter table public.contbus_fares enable row level security;

-- Reusable admin check against the existing profiles table (id -> auth.users.id, role text).
create or replace function public.is_contbus_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  );
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['contbus_stops', 'contbus_routes', 'contbus_route_stops', 'contbus_departures', 'contbus_fares']
  loop
    execute format('drop policy if exists "%1$s_public_select" on public.%1$s', table_name);
    execute format(
      'create policy "%1$s_public_select" on public.%1$s for select using (true)',
      table_name
    );

    execute format('drop policy if exists "%1$s_admin_insert" on public.%1$s', table_name);
    execute format(
      'create policy "%1$s_admin_insert" on public.%1$s for insert with check (public.is_contbus_admin())',
      table_name
    );

    execute format('drop policy if exists "%1$s_admin_update" on public.%1$s', table_name);
    execute format(
      'create policy "%1$s_admin_update" on public.%1$s for update using (public.is_contbus_admin()) with check (public.is_contbus_admin())',
      table_name
    );

    execute format('drop policy if exists "%1$s_admin_delete" on public.%1$s', table_name);
    execute format(
      'create policy "%1$s_admin_delete" on public.%1$s for delete using (public.is_contbus_admin())',
      table_name
    );
  end loop;
end $$;
