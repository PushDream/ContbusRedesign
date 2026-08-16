import { departureTimes, estimateArrival, fares, getPlatform, hashString, seededRandom } from "../data/content.js";
import { isSupabaseConfigured, supabase } from "./supabase.js";

const stationCodeByName = {
  Lublin: "LUB-DWORCOWA",
  "Warszawa Marriott": "WAW-MARRIOTT",
  "Lotnisko Chopina": "WAW-CHOPIN",
  "Lotnisko Modlin": "WMI-MODLIN",
};

function toDateOnly(value) {
  const date = new Date(`${value}T00:00:00`);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeText(value) {
  return String(value || "").slice(0, 5);
}

function isoDayOfWeek(value) {
  const day = new Date(`${value}T00:00:00`).getDay();
  return day === 0 ? 7 : day;
}

function contbusDirectionForRoute(originCode, destinationCode) {
  if (originCode?.startsWith("LUB-") && !destinationCode?.startsWith("LUB-")) return "lublin_warszawa";
  if (!originCode?.startsWith("LUB-") && destinationCode?.startsWith("LUB-")) return "warszawa_lublin";
  return "";
}

function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function appFareIdForRoute(origin, destination) {
  return fares.find((fare) => fare.from === origin && fare.to === destination)?.id;
}

function stationDisplayName(station) {
  if (station?.code === "LUB-DWORCOWA") return "Lublin";
  return station?.name || station?.city || "Przystanek";
}

function mapDbDeparture({ trip, route, origin, destination }) {
  const fareId = appFareIdForRoute(stationDisplayName(origin), stationDisplayName(destination));

  return {
    id: trip.id,
    tripId: trip.id,
    routeId: route.id,
    fareId,
    from: stationDisplayName(origin),
    to: stationDisplayName(destination),
    departureTime: timeText(trip.departure_time),
    arrivalTime: timeText(trip.arrival_time),
    duration: durationLabel(route.duration_minutes),
    durationMinutes: route.duration_minutes,
    price: Number(trip.price),
    platform: trip.platform,
    capacity: trip.capacity,
    status: trip.status,
    note: fares.find((fare) => fare.id === fareId)?.note || "bezpośrednio",
  };
}

function fallbackSeatsLeft(fareId, time) {
  const rng = seededRandom(hashString(`${fareId}-${time}-seats`));
  return 3 + Math.floor(rng() * 20);
}

function fallbackDepartures({ from, to }) {
  const fare = fares.find(
    (item) => item.from.toLowerCase() === from.toLowerCase() && item.to.toLowerCase() === to.toLowerCase(),
  );

  if (!fare) return [];

  return departureTimes.map((time, index) => ({
    id: `${fare.id}-${time}`,
    tripId: "",
    routeId: "",
    fareId: fare.id,
    from,
    to,
    departureTime: time,
    arrivalTime: estimateArrival(time),
    duration: fare.duration,
    durationMinutes: fare.durationMinutes,
    price: fare.price,
    platform: getPlatform(from, to, time),
    capacity: fallbackSeatsLeft(fare.id, time),
    status: "scheduled",
    note: fare.note,
    departureIndex: index,
    isFallback: true,
  }));
}

export async function fetchDepartures({ from, to, date }) {
  const originCode = stationCodeByName[from];
  const destinationCode = stationCodeByName[to];
  const departureDate = toDateOnly(date);
  const timetableDirection = contbusDirectionForRoute(originCode, destinationCode);

  if (!originCode || !destinationCode || originCode === destinationCode) {
    return [];
  }

  if (!isSupabaseConfigured) {
    return fallbackDepartures({ from, to });
  }

  const [
    { data: stations, error: stationsError },
    { data: routes, error: routesError },
    { data: trips, error: tripsError },
    activeTimetableResult,
  ] = await Promise.all([
    supabase.from("stations").select("*").in("code", [originCode, destinationCode]),
    supabase.from("routes").select("*").eq("active", true),
    supabase.rpc("public_trip_schedule", { p_date: departureDate }),
    timetableDirection
      ? supabase
          .from("contbus_departures")
          .select("departure_time, days_of_week")
          .eq("is_active", true)
          .eq("direction", timetableDirection)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (stationsError) throw stationsError;
  if (routesError) throw routesError;
  if (tripsError) throw tripsError;
  if (activeTimetableResult.error && activeTimetableResult.error.code !== "42P01") {
    throw activeTimetableResult.error;
  }

  const stationByCode = Object.fromEntries((stations || []).map((station) => [station.code, station]));
  const route = (routes || []).find(
    (item) =>
      item.origin_station_id === stationByCode[originCode]?.id &&
      item.destination_station_id === stationByCode[destinationCode]?.id,
  );

  if (!route) return [];

  const dayOfWeek = isoDayOfWeek(departureDate);
  const activeTimes = !timetableDirection || activeTimetableResult.error
    ? null
    : new Set(
        (activeTimetableResult.data || [])
          .filter((departure) => (departure.days_of_week || []).includes(dayOfWeek))
          .map((departure) => timeText(departure.departure_time)),
      );

  return (trips || [])
    .filter((trip) => trip.route_id === route.id)
    .filter((trip) => !activeTimes || activeTimes.has(timeText(trip.departure_time)))
    .map((trip) =>
      mapDbDeparture({
        trip,
        route,
        origin: stationByCode[originCode],
        destination: stationByCode[destinationCode],
      }),
    );
}

export async function resolveDeparture({ from, to, date, departureTime }) {
  const departures = await fetchDepartures({ from, to, date });
  return departures.find((departure) => departure.departureTime === departureTime) || null;
}

export async function createBookingRecord({
  tripId,
  buyer,
  passengerCount,
  seatNumber,
  seatNumbers,
  extras,
  paymentMethod,
}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  if (!tripId) {
    throw new Error("Selected departure is missing a Supabase trip id.");
  }

  const fullName = `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim() || buyer.name;
  const selectedSeats = (seatNumbers?.length ? seatNumbers : [seatNumber]).filter(Boolean);

  const { data, error } = await supabase.rpc("create_public_booking_with_seats", {
    p_trip_id: tripId,
    p_buyer_name: fullName,
    p_buyer_email: buyer.email,
    p_buyer_phone: buyer.phone,
    p_passenger_count: passengerCount,
    p_seat_numbers: selectedSeats,
    p_luggage: Boolean(extras.luggage),
    p_insurance: Boolean(extras.insurance),
    p_payment_method: paymentMethod,
  });

  if (error) throw error;

  return Array.isArray(data) ? data[0] : data;
}

export async function fetchCustomerBookings() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return [];

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (bookingsError) throw bookingsError;
  if (!bookings?.length) return [];

  const bookingIds = bookings.map((booking) => booking.id);
  const tripIds = [...new Set(bookings.map((booking) => booking.trip_id).filter(Boolean))];

  const [
    { data: passengers, error: passengersError },
    { data: trips, error: tripsError },
  ] = await Promise.all([
    supabase.from("booking_passengers").select("*").in("booking_id", bookingIds),
    supabase.from("trips").select("*").in("id", tripIds),
  ]);

  if (passengersError) throw passengersError;
  if (tripsError) throw tripsError;

  const routeIds = [...new Set((trips || []).map((trip) => trip.route_id).filter(Boolean))];
  const routesResult = routeIds.length
    ? await supabase.from("routes").select("*").in("id", routeIds)
    : { data: [], error: null };
  if (routesResult.error) throw routesResult.error;

  const stationIds = [
    ...new Set(
      (routesResult.data || [])
        .flatMap((route) => [route.origin_station_id, route.destination_station_id])
        .filter(Boolean),
    ),
  ];
  const stationsResult = stationIds.length
    ? await supabase.from("stations").select("*").in("id", stationIds)
    : { data: [], error: null };
  if (stationsResult.error) throw stationsResult.error;

  const passengersByBooking = (passengers || []).reduce((grouped, passenger) => {
    grouped[passenger.booking_id] = grouped[passenger.booking_id] || [];
    grouped[passenger.booking_id].push(passenger);
    return grouped;
  }, {});
  const tripById = Object.fromEntries((trips || []).map((trip) => [trip.id, trip]));
  const routeById = Object.fromEntries((routesResult.data || []).map((route) => [route.id, route]));
  const stationById = Object.fromEntries((stationsResult.data || []).map((station) => [station.id, station]));

  return bookings.map((booking) => {
    const trip = tripById[booking.trip_id];
    const route = routeById[trip?.route_id];
    const origin = stationById[route?.origin_station_id];
    const destination = stationById[route?.destination_station_id];
    const bookingPassengers = passengersByBooking[booking.id] || [];

    return {
      id: booking.id,
      reference: booking.booking_reference,
      status: booking.status,
      passengerCount: booking.passenger_count,
      totalAmount: Number(booking.total_amount),
      currency: booking.currency,
      createdAt: booking.created_at,
      buyerEmail: booking.buyer_email,
      buyerName: booking.buyer_name,
      route: `${formatStationName(origin?.name)} - ${formatStationName(destination?.name)}`,
      departureDate: trip?.departure_date,
      departureTime: timeText(trip?.departure_time),
      arrivalTime: timeText(trip?.arrival_time),
      seatNumbers: bookingPassengers.map((passenger) => passenger.seat_number),
      ticketCodes: bookingPassengers.map((passenger) => passenger.ticket_code),
    };
  });
}

function mapLookupBooking(booking) {
  if (!booking) return null;
  return {
    id: booking.booking_id,
    reference: booking.booking_reference,
    status: booking.booking_status,
    passengerCount: booking.passenger_count,
    totalAmount: Number(booking.total_amount),
    currency: booking.currency,
    buyerEmail: booking.buyer_email,
    buyerName: booking.buyer_name,
    route: booking.route_label,
    departureDate: booking.departure_date,
    departureTime: timeText(booking.departure_time),
    arrivalTime: timeText(booking.arrival_time),
    platform: booking.platform,
    seatNumbers: booking.seat_numbers || [],
    ticketCodes: booking.ticket_codes || [],
  };
}

export async function lookupPublicBooking({ code, email }) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const { data, error } = await supabase.rpc("lookup_public_booking", {
    p_code: code,
    p_email: email,
  });

  if (error) throw error;
  return mapLookupBooking(Array.isArray(data) ? data[0] : data);
}

export async function cancelPublicBooking({ code, email }) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const { data, error } = await supabase.rpc("cancel_public_booking", {
    p_code: code,
    p_email: email,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

function formatStationName(value) {
  if (!value) return "Przystanek";
  if (value.includes("Lublin")) return "Lublin";
  return value;
}

function mapPublicTrip({ trip, routeById, stationById }) {
  const route = routeById[trip.route_id];
  const origin = stationById[route?.origin_station_id];
  const destination = stationById[route?.destination_station_id];

  return {
    id: trip.id,
    departure_date: trip.departure_date,
    departure_time: trip.departure_time,
    arrival_time: trip.arrival_time,
    status: trip.status,
    platform: trip.platform,
    capacity: trip.capacity,
    price: Number(trip.price),
    route_code: route?.code || "-",
    duration_minutes: route?.duration_minutes || 0,
    base_price: Number(route?.base_price || trip.price || 0),
    origin_name: formatStationName(origin?.name),
    destination_name: formatStationName(destination?.name),
    vehicle_label: "Do przypisania",
    plate_number: "",
    booking_count: 0,
    passenger_count: 0,
    revenue_total: 0,
  };
}

async function fetchPublicDispatcherOverview(date) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const [
    { data: stations, error: stationsError },
    { data: routes, error: routesError },
    { data: trips, error: tripsError },
  ] = await Promise.all([
    supabase.from("stations").select("*").eq("active", true),
    supabase.from("routes").select("*").eq("active", true),
    supabase
      .from("trips")
      .select("*")
      .eq("departure_date", date)
      .neq("status", "cancelled")
      .order("departure_time", { ascending: true }),
  ]);

  if (stationsError) throw stationsError;
  if (routesError) throw routesError;
  if (tripsError) throw tripsError;

  const stationById = Object.fromEntries((stations || []).map((station) => [station.id, station]));
  const routeById = Object.fromEntries((routes || []).map((route) => [route.id, route]));
  const mappedTrips = (trips || []).map((trip) => mapPublicTrip({ trip, routeById, stationById }));

  const routeRows = (routes || []).map((route) => {
    const origin = stationById[route.origin_station_id];
    const destination = stationById[route.destination_station_id];
    const routeTrips = mappedTrips.filter((trip) => trip.route_code === route.code);
    return {
      id: route.id,
      code: route.code,
      origin_name: formatStationName(origin?.name),
      destination_name: formatStationName(destination?.name),
      duration_minutes: route.duration_minutes,
      base_price: Number(route.base_price),
      trips_today: routeTrips.length,
      bookings_today: 0,
      revenue_today: 0,
    };
  });

  return {
    date,
    summary: {
      trips: mappedTrips.length,
      bookings: 0,
      passengers: 0,
      revenue: 0,
      routes: routeRows.length,
      vehicles: 0,
    },
    trips: mappedTrips,
    routes: routeRows,
    recent_bookings: [],
    status_totals: mappedTrips.reduce((totals, trip) => {
      totals[trip.status] = (totals[trip.status] || 0) + 1;
      return totals;
    }, {}),
    isAggregateFallback: true,
  };
}

export async function fetchDispatcherOverview(date) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const dashboardDate = toDateOnly(date);
  const { data, error } = await supabase.rpc("dispatcher_dashboard_overview", {
    p_date: dashboardDate,
  });

  if (!error && data) {
    return { ...data, isAggregateFallback: false };
  }

  if (error?.code !== "42883" && error?.code !== "PGRST202") {
    throw error;
  }

  return fetchPublicDispatcherOverview(dashboardDate);
}

function groupBy(rows, key) {
  return (rows || []).reduce((grouped, row) => {
    const value = row[key];
    grouped[value] = grouped[value] || [];
    grouped[value].push(row);
    return grouped;
  }, {});
}

function routeLabel({ destination, origin }) {
  return `${formatStationName(origin?.name)} - ${formatStationName(destination?.name)}`;
}

export async function fetchAdminOperations(date) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const operationsDate = toDateOnly(date);
  const [
    { data: stations, error: stationsError },
    { data: routes, error: routesError },
    { data: trips, error: tripsError },
    { data: vehicles, error: vehiclesError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase.from("stations").select("*").eq("active", true),
    supabase.from("routes").select("*").eq("active", true),
    supabase
      .from("trips")
      .select("*")
      .eq("departure_date", operationsDate)
      .neq("status", "cancelled")
      .order("departure_time", { ascending: true }),
    supabase.from("vehicles").select("*").eq("active", true).order("label", { ascending: true }),
    supabase.from("profiles").select("id, role, full_name, phone, created_at").order("created_at", { ascending: false }),
  ]);

  if (stationsError) throw stationsError;
  if (routesError) throw routesError;
  if (tripsError) throw tripsError;
  if (vehiclesError) throw vehiclesError;
  if (profilesError) throw profilesError;

  const tripIds = (trips || []).map((trip) => trip.id);
  const { data: bookings, error: bookingsError } = tripIds.length
    ? await supabase.from("bookings").select("*").in("trip_id", tripIds).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (bookingsError) throw bookingsError;

  const bookingIds = (bookings || []).map((booking) => booking.id);
  const [
    { data: passengers, error: passengersError },
    { data: payments, error: paymentsError },
    { data: incidents, error: incidentsError },
    { data: events, error: eventsError },
  ] = await Promise.all([
    bookingIds.length
      ? supabase.from("booking_passengers").select("*").in("booking_id", bookingIds)
      : { data: [], error: null },
    bookingIds.length ? supabase.from("payments").select("*").in("booking_id", bookingIds) : { data: [], error: null },
    tripIds.length
      ? supabase.from("trip_incidents").select("*").in("trip_id", tripIds).order("created_at", { ascending: false })
      : { data: [], error: null },
    tripIds.length
      ? supabase.from("trip_events").select("*").in("trip_id", tripIds).order("created_at", { ascending: false }).limit(40)
      : { data: [], error: null },
  ]);

  if (passengersError) throw passengersError;
  if (paymentsError) throw paymentsError;
  if (incidentsError) throw incidentsError;
  if (eventsError) throw eventsError;

  const stationById = Object.fromEntries((stations || []).map((station) => [station.id, station]));
  const routeById = Object.fromEntries((routes || []).map((route) => [route.id, route]));
  const vehicleById = Object.fromEntries((vehicles || []).map((vehicle) => [vehicle.id, vehicle]));
  const profileById = Object.fromEntries((profiles || []).map((profile) => [profile.id, profile]));
  const passengersByBooking = groupBy(passengers, "booking_id");
  const paymentsByBooking = groupBy(payments, "booking_id");
  const bookingsByTrip = groupBy(bookings, "trip_id");
  const incidentsByTrip = groupBy(incidents, "trip_id");
  const eventsByTrip = groupBy(events, "trip_id");

  const mappedTrips = (trips || []).map((trip) => {
    const route = routeById[trip.route_id];
    const origin = stationById[route?.origin_station_id];
    const destination = stationById[route?.destination_station_id];
    const tripBookings = bookingsByTrip[trip.id] || [];

    return {
      ...trip,
      arrival_time: timeText(trip.arrival_time),
      departure_time: timeText(trip.departure_time),
      route_code: route?.code || "-",
      route_label: routeLabel({ destination, origin }),
      origin_name: formatStationName(origin?.name),
      destination_name: formatStationName(destination?.name),
      vehicle: vehicleById[trip.vehicle_id] || null,
      driver: profileById[trip.driver_id] || null,
      bookings: tripBookings,
      booking_count: tripBookings.filter((booking) => booking.status !== "cancelled").length,
      passenger_count: tripBookings
        .filter((booking) => booking.status !== "cancelled")
        .reduce((sum, booking) => sum + Number(booking.passenger_count || 0), 0),
      revenue_total: tripBookings
        .filter((booking) => booking.status !== "cancelled")
        .reduce((sum, booking) => sum + Number(booking.total_amount || 0), 0),
      incidents: incidentsByTrip[trip.id] || [],
      events: eventsByTrip[trip.id] || [],
    };
  });

  const tripById = Object.fromEntries(mappedTrips.map((trip) => [trip.id, trip]));
  const mappedBookings = (bookings || []).map((booking) => {
    const trip = tripById[booking.trip_id];
    const bookingPassengers = passengersByBooking[booking.id] || [];
    const payment = paymentsByBooking[booking.id]?.[0] || null;

    return {
      ...booking,
      passengers: bookingPassengers,
      payment,
      route_label: trip?.route_label || "Trasa",
      departure_date: trip?.departure_date,
      departure_time: trip?.departure_time,
      arrival_time: trip?.arrival_time,
      checked_in_count: bookingPassengers.filter((passenger) => passenger.checked_in_at).length,
    };
  });

  return {
    bookings: mappedBookings,
    drivers: (profiles || []).filter((profile) => profile.role === "driver"),
    events: events || [],
    incidents: incidents || [],
    profiles: profiles || [],
    trips: mappedTrips,
    vehicles: vehicles || [],
  };
}

export async function updateAdminTrip(tripId, values) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const payload = {};
  if ("driver_id" in values) payload.driver_id = values.driver_id || null;
  if ("platform" in values) payload.platform = values.platform || null;
  if ("status" in values) payload.status = values.status;
  if ("vehicle_id" in values) payload.vehicle_id = values.vehicle_id || null;

  const { data, error } = await supabase.rpc("update_staff_trip", {
    p_trip_id: tripId,
    p_patch: payload,
  });
  if (error) throw error;
  if (!data) {
    throw new Error("Trip update was not applied — check staff permissions.");
  }
}

export async function updateAdminBookingStatus(bookingId, status) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const { data, error } = await supabase.rpc("update_staff_booking_status", {
    p_booking_id: bookingId,
    p_status: status,
  });
  if (error) throw error;
  if (!data) {
    throw new Error("Booking status update was not applied — check staff permissions.");
  }
}

export async function updateAdminProfileRole(profileId, role) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured for this deployment.");
  }

  const { error } = await supabase.rpc("set_profile_role", {
    target_profile_id: profileId,
    target_role: role,
  });
  if (error) throw error;
}
