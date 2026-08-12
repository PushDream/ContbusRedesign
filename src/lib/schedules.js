import { isSupabaseConfigured, supabase } from "./supabase.js";

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }
}

export async function fetchScheduleData() {
  ensureConfigured();

  const [
    { data: stops, error: stopsError },
    { data: routes, error: routesError },
    { data: routeStops, error: routeStopsError },
    { data: departures, error: departuresError },
    { data: fares, error: faresError },
  ] = await Promise.all([
    supabase.from("contbus_stops").select("*").order("stop_order", { ascending: true }),
    supabase.from("contbus_routes").select("*").order("created_at", { ascending: true }),
    supabase.from("contbus_route_stops").select("*").order("stop_order", { ascending: true }),
    supabase.from("contbus_departures").select("*").order("departure_time", { ascending: true }),
    supabase.from("contbus_fares").select("*"),
  ]);

  if (stopsError) throw stopsError;
  if (routesError) throw routesError;
  if (routeStopsError) throw routeStopsError;
  if (departuresError) throw departuresError;
  if (faresError) throw faresError;

  return {
    stops: stops || [],
    routes: routes || [],
    routeStops: routeStops || [],
    departures: departures || [],
    fares: fares || [],
  };
}

export async function createDeparture(values) {
  ensureConfigured();
  const { error } = await supabase.from("contbus_departures").insert({
    route_id: values.routeId,
    departure_time: values.departureTime,
    direction: values.direction,
    days_of_week: values.daysOfWeek,
    trip_type: values.tripType || "regular",
    is_active: values.isActive ?? true,
    notes: values.notes || null,
  });
  if (error) throw error;
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

  const { error } = await supabase.from("contbus_departures").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteDeparture(id) {
  ensureConfigured();
  const { error } = await supabase.from("contbus_departures").delete().eq("id", id);
  if (error) throw error;
}

export async function updateStop(id, values) {
  ensureConfigured();
  const payload = {};
  if ("name" in values) payload.name = values.name;
  if ("city" in values) payload.city = values.city;
  if ("address" in values) payload.address = values.address;

  const { error } = await supabase.from("contbus_stops").update(payload).eq("id", id);
  if (error) throw error;
}

export async function updateFarePrice(id, pricePln) {
  ensureConfigured();
  const { error } = await supabase.from("contbus_fares").update({ price_pln: pricePln }).eq("id", id);
  if (error) throw error;
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
    { data: drivers, error: driversError },
    { data: vehicles, error: vehiclesError },
  ] = await Promise.all([
    supabase
      .from("trips")
      .select(
        `
        id, departure_date, departure_time, arrival_time, status, driver_id, vehicle_id,
        routes (code, base_price),
        profiles:driver_id (id, full_name),
        vehicles:vehicle_id (id, label, plate_number)
      `,
      )
      .gte("departure_date", startDate)
      .lte("departure_date", endDate)
      .order("departure_date", { ascending: true })
      .order("departure_time", { ascending: true }),
    supabase.from("profiles").select("id, full_name").eq("role", "driver").order("full_name", { ascending: true }),
    supabase.from("vehicles").select("id, label, plate_number").eq("active", true).order("label", { ascending: true }),
  ]);

  if (tripsError) throw tripsError;
  if (driversError) throw driversError;
  if (vehiclesError) throw vehiclesError;

  return {
    trips: trips || [],
    drivers: drivers || [],
    vehicles: vehicles || [],
  };
}

export async function updateTripAssignment(tripId, values) {
  ensureConfigured();
  const payload = {};
  if ("driverId" in values) payload.driver_id = values.driverId || null;
  if ("vehicleId" in values) payload.vehicle_id = values.vehicleId || null;

  const { error } = await supabase.from("trips").update(payload).eq("id", tripId);
  if (error) throw error;
}
