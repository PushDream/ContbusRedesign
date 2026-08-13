-- Keep the admin timetable active flag aligned with generated live trips.
-- The web app still treats contbus_departures.is_active as the source of truth,
-- but this links generated rows back to the timetable so future unbooked trips
-- can be hidden/restored when an admin toggles a departure.

alter table public.trips
  add column if not exists contbus_departure_id uuid references public.contbus_departures(id) on delete set null;

create index if not exists trips_contbus_departure_id_idx
  on public.trips (contbus_departure_id);

create or replace function public.contbus_live_route_code(p_direction text)
returns text
language sql
immutable
as $$
  select case p_direction
    when 'lublin_warszawa' then 'LUB-WAW'
    when 'warszawa_lublin' then 'WAW-LUB'
  end;
$$;

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
      dep.id as contbus_departure_id,
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
      on r.code = public.contbus_live_route_code(dep.direction)
  ),
  upserted as (
    insert into public.trips (
      route_id, contbus_departure_id, departure_date, departure_time, arrival_time,
      status, capacity, price, driver_id, vehicle_id
    )
    select
      route_id, contbus_departure_id, departure_date, departure_time, arrival_time,
      'scheduled', 40, coalesce(price, 0), null, null
    from candidates
    on conflict (route_id, departure_date, departure_time) do update set
      contbus_departure_id = excluded.contbus_departure_id,
      status = case
        when public.trips.status = 'cancelled'
         and not exists (
           select 1
           from public.bookings b
           where b.trip_id = public.trips.id
             and b.status <> 'cancelled'
         )
        then 'scheduled'
        else public.trips.status
      end
    returning (xmax::text = '0') as inserted
  )
  select count(*) into v_inserted
  from upserted
  where inserted;

  return v_inserted;
end;
$$;

create or replace function public.set_contbus_departure_active(
  p_departure_id uuid,
  p_is_active boolean
)
returns public.contbus_departures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_departure public.contbus_departures%rowtype;
  v_live_route_id uuid;
begin
  if not public.is_contbus_admin() then
    raise exception 'Only admins can update departures';
  end if;

  update public.contbus_departures
  set is_active = p_is_active,
      updated_at = now()
  where id = p_departure_id
  returning * into v_departure;

  if not found then
    raise exception 'Departure not found';
  end if;

  select id into v_live_route_id
  from public.routes
  where code = public.contbus_live_route_code(v_departure.direction)
  limit 1;

  if v_live_route_id is not null then
    update public.trips t
    set contbus_departure_id = v_departure.id
    where t.departure_date >= current_date
      and t.route_id = v_live_route_id
      and t.departure_time = v_departure.departure_time
      and extract(isodow from t.departure_date)::integer = any(v_departure.days_of_week)
      and (t.contbus_departure_id is null or t.contbus_departure_id = v_departure.id);

    update public.trips t
    set status = case when p_is_active then 'scheduled' else 'cancelled' end
    where t.contbus_departure_id = v_departure.id
      and t.departure_date >= current_date
      and t.status <> case when p_is_active then 'scheduled' else 'cancelled' end
      and not exists (
        select 1
        from public.bookings b
        where b.trip_id = t.id
          and b.status <> 'cancelled'
      );
  end if;

  return v_departure;
end;
$$;

grant execute on function public.generate_contbus_trips(date, date) to authenticated;
grant execute on function public.set_contbus_departure_active(uuid, boolean) to authenticated;
