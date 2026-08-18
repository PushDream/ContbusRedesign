begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(21);

select ok(
  to_regprocedure('public.public_trip_schedule(date)') is not null,
  'the narrow public schedule RPC exists'
);

select ok(
  coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure('public.public_trip_schedule(date)'),
      'EXECUTE'
    ),
    false
  ),
  'anonymous callers can execute the narrow public schedule RPC'
);

select ok(
  (
    select bool_and(
      to_regprocedure(public_rpc.signature) is not null
      and coalesce(
        has_function_privilege(
          'anon',
          to_regprocedure(public_rpc.signature),
          'EXECUTE'
        ),
        false
      )
    )
    from (
      values
        ('public.create_public_booking_with_seats(uuid,text,text,text,integer,text[],boolean,boolean,text)'),
        ('public.lookup_public_booking(text,text)'),
        ('public.cancel_public_booking(text,text)')
    ) as public_rpc(signature)
  ),
  'anonymous callers retain only the intentional public booking RPCs'
);

select ok(
  to_regprocedure(
    'public.create_public_booking(uuid,text,text,text,integer,text,boolean,boolean,text)'
  ) is null
  or not coalesce(
    has_function_privilege(
      'anon',
      to_regprocedure(
        'public.create_public_booking(uuid,text,text,text,integer,text,boolean,boolean,text)'
      ),
      'EXECUTE'
    ),
    true
  ),
  'anonymous execution is revoked from the legacy single-seat booking function'
);

select ok(
  not has_table_privilege('anon', 'public.trips', 'SELECT')
  and not has_any_column_privilege('anon', 'public.trips', 'SELECT'),
  'anonymous callers cannot select the trips table directly'
);

select ok(
  coalesce(
    (
      select pg_get_function_result(p.oid)
        !~* '(driver|vehicle|live_|gps)'
      from pg_proc p
      where p.oid = to_regprocedure('public.public_trip_schedule(date)')
    ),
    false
  ),
  'the public schedule result has no driver, vehicle, live-location, or GPS fields'
);

select ok(
  not has_column_privilege('anon', 'public.contbus_departures', 'notes', 'SELECT')
  and not has_column_privilege('anon', 'public.contbus_routes', 'permit_number', 'SELECT')
  and not has_column_privilege('anon', 'public.contbus_routes', 'valid_from', 'SELECT')
  and not has_column_privilege('anon', 'public.contbus_routes', 'valid_until', 'SELECT'),
  'anonymous schedule reads do not expose notes or permit-validity metadata'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('profiles'),
        ('stations'),
        ('routes'),
        ('route_stops'),
        ('vehicles'),
        ('trips'),
        ('bookings'),
        ('booking_extras'),
        ('booking_passengers'),
        ('payments'),
        ('trip_incidents'),
        ('trip_events'),
        ('contbus_stops'),
        ('contbus_routes'),
        ('contbus_route_stops'),
        ('contbus_departures'),
        ('contbus_fares')
    ) as protected_tables(table_name)
    cross join (
      values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')
    ) as write_privileges(privilege_name)
    where has_table_privilege(
      'anon',
      format('public.%I', protected_tables.table_name),
      write_privileges.privilege_name
    )
  ),
  'anonymous callers have no direct table-level write privileges'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('profiles'),
        ('stations'),
        ('routes'),
        ('route_stops'),
        ('vehicles'),
        ('trips'),
        ('bookings'),
        ('booking_extras'),
        ('booking_passengers'),
        ('payments'),
        ('trip_incidents'),
        ('trip_events'),
        ('contbus_stops'),
        ('contbus_routes'),
        ('contbus_route_stops'),
        ('contbus_departures'),
        ('contbus_fares')
    ) as protected_tables(table_name)
    cross join (
      values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')
    ) as write_privileges(privilege_name)
    where has_table_privilege(
      'authenticated',
      format('public.%I', protected_tables.table_name),
      write_privileges.privilege_name
    )
  ),
  'authenticated callers have no broad table-level write privileges'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('profiles'),
        ('stations'),
        ('routes'),
        ('route_stops'),
        ('vehicles'),
        ('trips'),
        ('bookings'),
        ('booking_extras'),
        ('booking_passengers'),
        ('payments'),
        ('trip_incidents'),
        ('trip_events'),
        ('contbus_stops'),
        ('contbus_routes'),
        ('contbus_route_stops'),
        ('contbus_departures'),
        ('contbus_fares')
    ) as protected_tables(table_name)
    where has_any_column_privilege(
      'anon',
      format('public.%I', protected_tables.table_name),
      'INSERT'
    )
    or has_any_column_privilege(
      'anon',
      format('public.%I', protected_tables.table_name),
      'UPDATE'
    )
  ),
  'anonymous callers have no column-level insert or update back door'
);

select ok(
  not exists (
    select 1
    from (
      values
        ('stations'),
        ('routes'),
        ('route_stops'),
        ('vehicles'),
        ('trips'),
        ('bookings'),
        ('booking_extras'),
        ('booking_passengers'),
        ('payments'),
        ('trip_incidents'),
        ('trip_events'),
        ('contbus_stops'),
        ('contbus_routes'),
        ('contbus_route_stops'),
        ('contbus_departures'),
        ('contbus_fares')
    ) as protected_tables(table_name)
    where has_any_column_privilege(
      'authenticated',
      format('public.%I', protected_tables.table_name),
      'INSERT'
    )
    or has_any_column_privilege(
      'authenticated',
      format('public.%I', protected_tables.table_name),
      'UPDATE'
    )
  ),
  'authenticated callers cannot bypass scoped write RPCs with column grants'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.profiles',
    'role',
    'UPDATE'
  ),
  'profile roles cannot be updated directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.trips', 'SELECT')
  and not exists (
    select 1
    from information_schema.columns column_catalog
    where column_catalog.table_schema = 'public'
      and column_catalog.table_name = 'trips'
      and (
        (
          column_catalog.column_name in (
            'id',
            'route_id',
            'departure_date',
            'departure_time',
            'arrival_time',
            'status',
            'driver_id',
            'vehicle_id',
            'platform',
            'capacity',
            'price'
          )
          and not has_column_privilege(
            'authenticated',
            'public.trips',
            column_catalog.column_name,
            'SELECT'
          )
        )
        or (
          column_catalog.column_name not in (
            'id',
            'route_id',
            'departure_date',
            'departure_time',
            'arrival_time',
            'status',
            'driver_id',
            'vehicle_id',
            'platform',
            'capacity',
            'price'
          )
          and has_column_privilege(
            'authenticated',
            'public.trips',
            column_catalog.column_name,
            'SELECT'
          )
        )
      )
  ),
  'authenticated callers have only the intended operational trip columns'
);

select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
  and not exists (
    select 1
    from information_schema.columns column_catalog
    where column_catalog.table_schema = 'public'
      and column_catalog.table_name = 'profiles'
      and (
        has_column_privilege(
          'authenticated',
          'public.profiles',
          column_catalog.column_name,
          'INSERT'
        ) is distinct from (column_catalog.column_name in ('id', 'full_name', 'phone'))
        or has_column_privilege(
          'authenticated',
          'public.profiles',
          column_catalog.column_name,
          'UPDATE'
        ) is distinct from (column_catalog.column_name in ('full_name', 'phone'))
      )
  ),
  'profile inserts and updates are limited to the self-service columns'
);

select ok(
  (
    select bool_and(
      to_regprocedure(required.signature) is not null
      and coalesce(
        has_function_privilege(
          'authenticated',
          to_regprocedure(required.signature),
          'EXECUTE'
        ),
        false
      )
    )
    from (
      values
        ('public.driver_assigned_trips(date)'),
        ('public.update_assigned_trip_status(uuid,public.trip_status)'),
        ('public.set_assigned_passenger_check_in(uuid,boolean)'),
        ('public.set_profile_role(uuid,public.app_role)'),
        ('public.update_staff_trip(uuid,jsonb)'),
        ('public.update_staff_booking_status(uuid,public.booking_status)'),
        ('public.dispatcher_dashboard_overview(date)'),
        ('public.generate_contbus_trips(date,date)'),
        ('public.create_contbus_departure(uuid,time without time zone,text,integer[],text,boolean,text)'),
        ('public.update_contbus_departure(uuid,jsonb)'),
        ('public.delete_contbus_departure(uuid)'),
        ('public.update_contbus_stop(uuid,jsonb)'),
        ('public.update_contbus_fare_price(uuid,numeric)'),
        ('public.staff_schedule_overview()'),
        ('public.customer_booking_history()'),
        ('public.report_assigned_trip_incident(uuid,text,text)')
    ) as required(signature)
  ),
  'authenticated callers can execute the scoped operational RPCs'
);

select ok(
  (
    select bool_and(
      to_regprocedure(unused_rpc.signature) is not null
      and not coalesce(
        has_function_privilege(
          'authenticated',
          to_regprocedure(unused_rpc.signature),
          'EXECUTE'
        ),
        true
      )
    )
    from (
      values
        ('public.lookup_ticket_trip(text[])'),
        ('public.assess_ticket_for_trip(text[],uuid)'),
        ('public.transfer_ticket_to_trip(text[],uuid)')
    ) as unused_rpc(signature)
  ),
  'unused privileged ticket-transfer RPCs are not executable by authenticated callers'
);

select ok(
  (
    select bool_and(
      to_regprocedure(required.signature) is not null
      and not coalesce(
        has_function_privilege(
          'anon',
          to_regprocedure(required.signature),
          'EXECUTE'
        ),
        true
      )
    )
    from (
      values
        ('public.driver_assigned_trips(date)'),
        ('public.update_assigned_trip_status(uuid,public.trip_status)'),
        ('public.set_assigned_passenger_check_in(uuid,boolean)'),
        ('public.set_profile_role(uuid,public.app_role)'),
        ('public.update_staff_trip(uuid,jsonb)'),
        ('public.update_staff_booking_status(uuid,public.booking_status)'),
        ('public.dispatcher_dashboard_overview(date)'),
        ('public.lookup_ticket_trip(text[])'),
        ('public.assess_ticket_for_trip(text[],uuid)'),
        ('public.transfer_ticket_to_trip(text[],uuid)'),
        ('public.generate_contbus_trips(date,date)'),
        ('public.set_contbus_departure_active(uuid,boolean)'),
        ('public.create_contbus_departure(uuid,time without time zone,text,integer[],text,boolean,text)'),
        ('public.update_contbus_departure(uuid,jsonb)'),
        ('public.delete_contbus_departure(uuid)'),
        ('public.update_contbus_stop(uuid,jsonb)'),
        ('public.update_contbus_fare_price(uuid,numeric)'),
        ('public.staff_schedule_overview()'),
        ('public.customer_booking_history()'),
        ('public.report_assigned_trip_incident(uuid,text,text)')
    ) as required(signature)
  ),
  'anonymous callers cannot execute operational or administrative RPCs'
);

select ok(
  (
    select bool_and(
      to_regprocedure(privileged.signature) is not null
      and not coalesce(
        has_function_privilege(
          'anon',
          to_regprocedure(privileged.signature),
          'EXECUTE'
        ),
        true
      )
    )
    from (
      values
        ('public.current_app_role()'),
        ('public.is_staff()'),
        ('public.is_driver_for_trip(uuid)'),
        ('public.is_contbus_admin()'),
        ('public.handle_new_user()'),
        ('public.generate_contbus_trips(date,date)'),
        ('public.set_contbus_departure_active(uuid,boolean)'),
        ('public.dispatcher_dashboard_overview(date)'),
        ('public.lookup_ticket_trip(text[])'),
        ('public.assess_ticket_for_trip(text[],uuid)'),
        ('public.transfer_ticket_to_trip(text[],uuid)'),
        ('public.create_contbus_departure(uuid,time without time zone,text,integer[],text,boolean,text)'),
        ('public.update_contbus_departure(uuid,jsonb)'),
        ('public.delete_contbus_departure(uuid)'),
        ('public.update_contbus_stop(uuid,jsonb)'),
        ('public.update_contbus_fare_price(uuid,numeric)'),
        ('public.staff_schedule_overview()'),
        ('public.customer_booking_history()'),
        ('public.report_assigned_trip_incident(uuid,text,text)')
    ) as privileged(signature)
  ),
  'anonymous execution is revoked from privileged helper and mutation functions'
);

select is_empty(
  $$
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind = 'f'
      and not coalesce('search_path=""' = any(p.proconfig), false)
  $$,
  'application functions use an immutable empty search path'
);

select is_empty(
  $$
    with relevant_roles as (
      select rolname, oid
      from pg_roles
      where rolname in ('anon', 'authenticated')
    ),
    commands(command_code) as (
      values ('r'::"char"), ('a'::"char"), ('w'::"char"), ('d'::"char")
    )
    select
      table_class.relname || ':' || relevant_roles.rolname || ':' || commands.command_code::text
    from pg_policy policy_catalog
    join pg_class table_class on table_class.oid = policy_catalog.polrelid
    join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
    cross join relevant_roles
    cross join commands
    where table_namespace.nspname = 'public'
      and policy_catalog.polpermissive
      and (
        0::oid = any(policy_catalog.polroles)
        or relevant_roles.oid = any(policy_catalog.polroles)
      )
      and (
        policy_catalog.polcmd = '*'::"char"
        or policy_catalog.polcmd = commands.command_code
      )
    group by table_class.relname, relevant_roles.rolname, commands.command_code
    having count(*) > 1
  $$,
  'anon and authenticated have at most one permissive policy per table action'
);

select is_empty(
  $$
    select table_class.relname || ':' || policy_catalog.polname
    from pg_policy policy_catalog
    join pg_class table_class on table_class.oid = policy_catalog.polrelid
    join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
    where table_namespace.nspname = 'public'
      and (
        replace(
          lower(coalesce(pg_get_expr(policy_catalog.polqual, policy_catalog.polrelid), '')),
          'select auth.uid()',
          ''
        ) like '%auth.uid()%'
        or replace(
          lower(coalesce(pg_get_expr(policy_catalog.polwithcheck, policy_catalog.polrelid), '')),
          'select auth.uid()',
          ''
        ) like '%auth.uid()%'
      )
  $$,
  'RLS policies avoid per-row direct auth.uid() evaluation'
);

select * from finish();
rollback;
