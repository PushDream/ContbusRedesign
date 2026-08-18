import { isSupabaseConfigured, supabase } from "./supabase.js";

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }
}

function timeText(value) {
  return String(value || "").slice(0, 5);
}

function addMinutes(value, minutes) {
  const [hours = 0, mins = 0] = timeText(value).split(":").map(Number);
  const total = ((hours * 60 + mins + Number(minutes || 0)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function stationLabel(station) {
  if (!station) return "Przystanek";
  return [station.name, station.address].filter(Boolean).join(", ") || station.city || "Przystanek";
}

function assertApplied(data, message) {
  if (data !== true) throw new Error(message);
}

export async function fetchDriverTrips(date) {
  ensureConfigured();

  const { data: trips, error: tripsError } = await supabase.rpc("driver_assigned_trips", {
    p_date: date,
  });
  if (tripsError) throw tripsError;
  if (!trips?.length) return [];

  const tripIds = trips.map((trip) => trip.id);
  const routeIds = [...new Set(trips.map((trip) => trip.route_id).filter(Boolean))];
  const vehicleIds = [...new Set(trips.map((trip) => trip.vehicle_id).filter(Boolean))];

  const [routesResult, routeStopsResult, vehiclesResult, bookingsResult] = await Promise.all([
    routeIds.length
      ? supabase
          .from("routes")
          .select("id, code, origin_station_id, destination_station_id, duration_minutes")
          .in("id", routeIds)
      : Promise.resolve({ data: [], error: null }),
    routeIds.length
      ? supabase
          .from("route_stops")
          .select("route_id, station_id, stop_order, offset_minutes")
          .in("route_id", routeIds)
          .order("stop_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length
      ? supabase.from("vehicles").select("id, label, plate_number, seats_total").in("id", vehicleIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("bookings")
      .select("id, trip_id, status")
      .in("trip_id", tripIds)
      .in("status", ["pending", "paid"]),
  ]);

  if (routesResult.error) throw routesResult.error;
  if (routeStopsResult.error) throw routeStopsResult.error;
  if (vehiclesResult.error) throw vehiclesResult.error;
  if (bookingsResult.error) throw bookingsResult.error;

  const bookings = bookingsResult.data || [];
  const bookingIds = bookings.map((booking) => booking.id);
  const stationIds = [
    ...new Set(
      [
        ...(routesResult.data || []).flatMap((route) => [route.origin_station_id, route.destination_station_id]),
        ...(routeStopsResult.data || []).map((stop) => stop.station_id),
      ].filter(Boolean),
    ),
  ];

  const [stationsResult, passengersResult] = await Promise.all([
    stationIds.length
      ? supabase.from("stations").select("id, code, name, city, address").in("id", stationIds)
      : Promise.resolve({ data: [], error: null }),
    bookingIds.length
      ? supabase
          .from("booking_passengers")
          .select("id, booking_id, full_name, seat_number, ticket_code, check_in_status, checked_in_at")
          .in("booking_id", bookingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (stationsResult.error) throw stationsResult.error;
  if (passengersResult.error) throw passengersResult.error;

  const routeById = Object.fromEntries((routesResult.data || []).map((route) => [route.id, route]));
  const vehicleById = Object.fromEntries((vehiclesResult.data || []).map((vehicle) => [vehicle.id, vehicle]));
  const stationById = Object.fromEntries((stationsResult.data || []).map((station) => [station.id, station]));
  const routeStopsByRoute = (routeStopsResult.data || []).reduce((grouped, stop) => {
    grouped[stop.route_id] = grouped[stop.route_id] || [];
    grouped[stop.route_id].push(stop);
    return grouped;
  }, {});
  const bookingsByTrip = bookings.reduce((grouped, booking) => {
    grouped[booking.trip_id] = grouped[booking.trip_id] || [];
    grouped[booking.trip_id].push(booking);
    return grouped;
  }, {});
  const passengersByBooking = (passengersResult.data || []).reduce((grouped, passenger) => {
    grouped[passenger.booking_id] = grouped[passenger.booking_id] || [];
    grouped[passenger.booking_id].push(passenger);
    return grouped;
  }, {});

  return trips.map((trip) => {
    const route = routeById[trip.route_id];
    const origin = stationById[route?.origin_station_id];
    const destination = stationById[route?.destination_station_id];
    const vehicle = vehicleById[trip.vehicle_id];
    const passengerRows = (bookingsByTrip[trip.id] || []).flatMap(
      (booking) => passengersByBooking[booking.id] || [],
    );
    let stops = (routeStopsByRoute[trip.route_id] || []).map((stop) => ({
      title: stationLabel(stationById[stop.station_id]),
      time: addMinutes(trip.departure_time, stop.offset_minutes),
      board: 0,
      drop: 0,
    }));

    if (!stops.length) {
      stops = [
        { title: stationLabel(origin), time: timeText(trip.departure_time), board: passengerRows.length, drop: 0 },
        { title: stationLabel(destination), time: timeText(trip.arrival_time), board: 0, drop: passengerRows.length },
      ];
    } else if (stops.length === 1) {
      stops[0].board = passengerRows.length;
      stops.push({
        title: stationLabel(destination),
        time: timeText(trip.arrival_time),
        board: 0,
        drop: passengerRows.length,
      });
    } else {
      stops[0].board = passengerRows.length;
      stops[stops.length - 1].drop = passengerRows.length;
    }

    return {
      ...trip,
      reference: `${route?.code || "KURS"}-${timeText(trip.departure_time).replace(":", "")}`,
      route: `${stationLabel(origin)} - ${stationLabel(destination)}`,
      vehicle: vehicle?.label || "Pojazd nieprzypisany",
      plate: vehicle?.plate_number || "",
      departure: timeText(trip.departure_time),
      arrival: timeText(trip.arrival_time),
      stops,
      passengers: passengerRows.map((passenger) => ({
        id: passenger.id,
        code: passenger.ticket_code,
        name: passenger.full_name,
        seat: passenger.seat_number || "-",
        stop: stationLabel(origin),
        luggage: "",
        checked: passenger.check_in_status === "boarded" || Boolean(passenger.checked_in_at),
      })),
    };
  });
}

export async function updateDriverTripStatus(tripId, status) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("update_assigned_trip_status", {
    p_trip_id: tripId,
    p_status: status,
  });
  if (error) throw error;
  assertApplied(data, "Trip status update was not applied.");
}

export async function setDriverPassengerCheckIn(passengerId, checkedIn) {
  ensureConfigured();
  const { data, error } = await supabase.rpc("set_assigned_passenger_check_in", {
    p_passenger_id: passengerId,
    p_checked_in: checkedIn,
  });
  if (error) throw error;
  assertApplied(data, "Passenger check-in was not applied.");
}

export async function reportDriverTripIncident(tripId, note, severity = "info") {
  ensureConfigured();
  const { data, error } = await supabase.rpc("report_assigned_trip_incident", {
    p_trip_id: tripId,
    p_severity: severity,
    p_note: note,
  });
  if (error) throw error;
  assertApplied(data, "Incident report was not saved.");
}
