-- Captured from the migration already applied to production on 2026-08-16.
-- The follow-up hardening migration removes the deferred direct-access paths.

create or replace function public.set_profile_role(target_profile_id uuid, target_role public.app_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_contbus_admin() then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;

  update public.profiles
  set role = target_role
  where id = target_profile_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

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
    t.id, t.route_id, t.departure_date, t.departure_time, t.arrival_time,
    t.status, t.platform, t.capacity, t.price
  from public.trips t
  where t.departure_date = p_date
    and t.status <> 'cancelled'::public.trip_status
  order by t.departure_time;
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
  if auth.uid() is null
     or public.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  return query
  select
    t.id, t.route_id, t.departure_date, t.departure_time, t.arrival_time,
    t.status, t.driver_id, t.vehicle_id, t.platform, t.capacity, t.price
  from public.trips t
  where t.departure_date = p_date
    and t.status <> 'cancelled'::public.trip_status
    and (t.driver_id = auth.uid() or public.is_staff())
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
  changed integer;
begin
  if auth.uid() is null
     or public.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  if p_status not in (
    'scheduled'::public.trip_status,
    'boarding'::public.trip_status,
    'departed'::public.trip_status,
    'delayed'::public.trip_status,
    'arrived'::public.trip_status
  ) then
    raise exception 'Unsupported trip status.' using errcode = '22023';
  end if;

  update public.trips t
  set status = p_status
  where t.id = p_trip_id
    and (t.driver_id = auth.uid() or public.is_staff());

  get diagnostics changed = row_count;
  return changed = 1;
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
  target_trip_id uuid;
  changed integer;
begin
  if auth.uid() is null
     or public.current_app_role() not in ('driver', 'dispatcher', 'admin') then
    raise exception 'Operational account required.' using errcode = '42501';
  end if;

  select b.trip_id
  into target_trip_id
  from public.booking_passengers bp
  join public.bookings b on b.id = bp.booking_id
  where bp.id = p_passenger_id
    and b.status <> 'cancelled'::public.booking_status;

  if target_trip_id is null or not public.is_driver_for_trip(target_trip_id) then
    raise exception 'Passenger is not on an assigned trip.' using errcode = '42501';
  end if;

  update public.booking_passengers bp
  set
    checked_in_at = case when p_checked_in then now() else null end,
    checked_in_by = case when p_checked_in then auth.uid() else null end,
    check_in_status = case
      when p_checked_in then 'boarded'::public.check_in_status
      else 'pending'::public.check_in_status
    end
  where bp.id = p_passenger_id;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.update_staff_trip(p_trip_id uuid, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
  unsupported_key text;
begin
  if not public.is_staff() then
    raise exception 'Staff account required.' using errcode = '42501';
  end if;

  select key into unsupported_key
  from jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) key
  where key not in ('driver_id', 'vehicle_id', 'platform', 'status')
  limit 1;

  if unsupported_key is not null then
    raise exception 'Unsupported trip field: %', unsupported_key using errcode = '22023';
  end if;

  update public.trips t
  set
    driver_id = case when p_patch ? 'driver_id' then nullif(p_patch->>'driver_id', '')::uuid else t.driver_id end,
    vehicle_id = case when p_patch ? 'vehicle_id' then nullif(p_patch->>'vehicle_id', '')::uuid else t.vehicle_id end,
    platform = case when p_patch ? 'platform' then nullif(p_patch->>'platform', '') else t.platform end,
    status = case when p_patch ? 'status' then (p_patch->>'status')::public.trip_status else t.status end
  where t.id = p_trip_id;

  get diagnostics changed = row_count;
  return changed = 1;
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
declare
  changed integer;
begin
  if not public.is_staff() then
    raise exception 'Staff account required.' using errcode = '42501';
  end if;

  update public.bookings b
  set status = p_status
  where b.id = p_booking_id;

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke execute on function public.set_profile_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_profile_role(uuid, public.app_role) to authenticated;
revoke execute on function public.public_trip_schedule(date) from public;
grant execute on function public.public_trip_schedule(date) to anon, authenticated;
revoke execute on function public.driver_assigned_trips(date) from public, anon;
grant execute on function public.driver_assigned_trips(date) to authenticated;
revoke execute on function public.update_assigned_trip_status(uuid, public.trip_status) from public, anon;
grant execute on function public.update_assigned_trip_status(uuid, public.trip_status) to authenticated;
revoke execute on function public.set_assigned_passenger_check_in(uuid, boolean) from public, anon;
grant execute on function public.set_assigned_passenger_check_in(uuid, boolean) to authenticated;
revoke execute on function public.update_staff_trip(uuid, jsonb) from public, anon;
grant execute on function public.update_staff_trip(uuid, jsonb) to authenticated;
revoke execute on function public.update_staff_booking_status(uuid, public.booking_status) from public, anon;
grant execute on function public.update_staff_booking_status(uuid, public.booking_status) to authenticated;
