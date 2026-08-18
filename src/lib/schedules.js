import { isSupabaseConfigured, supabase } from "./supabase.js";

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }
}

export async function fetchScheduleData() {
  ensureConfigured();
  const { data, error } = await supabase.rpc("staff_schedule_overview");
  if (error) throw error;

  let result = Array.isArray(data) && data.length === 1 ? data[0] : data;
  if (typeof result === "string") result = JSON.parse(result);
  result = result && typeof result === "object" ? result : {};

  return {
    stops: result.stops || [],
    routes: result.routes || [],
    routeStops: result.routeStops || result.route_stops || [],
    departures: result.departures || [],
    fares: result.fares || [],
  };
}

export async function createDeparture(values) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("create_contbus_departure", {
    p_route_id: values.routeId,
    p_departure_time: values.departureTime,
    p_direction: values.direction,
    p_days_of_week: values.daysOfWeek,
    p_trip_type: values.tripType || "regular",
    p_is_active: values.isActive ?? true,
    p_notes: values.notes || null,
  });
  if (error) throw error;
  if (data === false || data == null) {
    throw new Error("Departure was not created — check admin permissions.");
  }
}

export async function updateDeparture(id, values) {
  ensureConfigured();
  const payload = {};
  if ("departureTime" in values) payload.departure_time = values.departureTime;
  if ("direction" in values) payload.direction = values.direction;
  if ("daysOfWeek" in values) payload.days_of_week = values.daysOfWeek;
  if ("tripType" in values) payload.trip_type = values.tripType;
  if ("isActive" in values) payload.is_active = values.isActive;
  if ("notes" in values) payload.notes = values.notes || null;

  const { data, error } = await supabase.rpc("update_contbus_departure", {
    p_departure_id: id,
    p_patch: payload,
  });
  if (error) {
    console.error("updateDeparture failed", { id, payload, error });
    throw error;
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (result === false || result == null) {
    console.error("updateDeparture affected 0 rows", { id, payload });
    throw new Error("Departure update was not applied — check admin permissions.");
  }
  return typeof result === "object" ? result : payload;
}

export async function deleteDeparture(id) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("delete_contbus_departure", {
    p_departure_id: id,
  });
  if (error) throw error;
  if (data === false || data == null) {
    throw new Error("Departure was not deleted — check admin permissions.");
  }
}

export async function updateStop(id, values) {
  ensureConfigured();
  const payload = {};
  if ("name" in values) payload.name = values.name;
  if ("city" in values) payload.city = values.city;
  if ("address" in values) payload.address = values.address;

  const { data, error } = await supabase.rpc("update_contbus_stop", {
    p_stop_id: id,
    p_patch: payload,
  });
  if (error) throw error;
  if (data === false || data == null) {
    throw new Error("Stop update was not applied — check admin permissions.");
  }
}

export async function updateFarePrice(id, pricePln) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("update_contbus_fare_price", {
    p_fare_id: id,
    p_price_pln: pricePln,
  });
  if (error) throw error;
  if (data === false || data == null) {
    throw new Error("Fare update was not applied — check admin permissions.");
  }
}

export async function generateContbusTrips(startDate, endDate) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("generate_contbus_trips", {
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw error;
  return Number(data) || 0;
}

export async function fetchTripAssignments(startDate, endDate) {
  ensureConfigured();

  const [
    { data: trips, error: tripsError },
    { data: routes, error: routesError },
    { data: drivers, error: driversError },
    { data: vehicles, error: vehiclesError },
  ] = await Promise.all([
    supabase
      .from("trips")
      .select("id, departure_date, departure_time, arrival_time, status, driver_id, vehicle_id, route_id")
      .gte("departure_date", startDate)
      .lte("departure_date", endDate)
      .order("departure_date", { ascending: true })
      .order("departure_time", { ascending: true }),
    supabase.from("routes").select("id, code, base_price"),
    supabase.from("profiles").select("id, full_name").eq("role", "driver").order("full_name", { ascending: true }),
    supabase.from("vehicles").select("id, label, plate_number").eq("active", true).order("label", { ascending: true }),
  ]);

  if (tripsError) {
    console.error("fetchTripAssignments: trips query failed", tripsError);
    throw tripsError;
  }
  if (routesError) {
    console.error("fetchTripAssignments: routes query failed", routesError);
    throw routesError;
  }
  if (driversError) {
    console.error("fetchTripAssignments: drivers query failed", driversError);
    throw driversError;
  }
  if (vehiclesError) {
    console.error("fetchTripAssignments: vehicles query failed", vehiclesError);
    throw vehiclesError;
  }

  // Joined client-side (rather than via a nested Supabase select) to match the rest of
  // the codebase's pattern (see fetchAdminOperations in database.js) and avoid relying
  // on PostgREST's foreign-key relationship auto-detection for the embed.
  const routeById = Object.fromEntries((routes || []).map((route) => [route.id, route]));

  return {
    trips: (trips || []).map((trip) => ({ ...trip, route: routeById[trip.route_id] || null })),
    drivers: drivers || [],
    vehicles: vehicles || [],
  };
}

export async function updateTripAssignment(tripId, values) {
  ensureConfigured();
  const payload = {};
  if ("driverId" in values) payload.driver_id = values.driverId || null;
  if ("vehicleId" in values) payload.vehicle_id = values.vehicleId || null;

  const { data, error } = await supabase.rpc("update_staff_trip", {
    p_trip_id: tripId,
    p_patch: payload,
  });
  if (error) throw error;
  if (!data) {
    throw new Error("Trip assignment was not applied — check staff permissions.");
  }
}
