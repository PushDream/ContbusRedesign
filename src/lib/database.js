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
  ] = await Promise.all([
    supabase.from("stations").select("*").in("code", [originCode, destinationCode]),
    supabase.from("routes").select("*").eq("active", true),
    supabase
      .from("trips")
      .select("*")
      .eq("departure_date", departureDate)
      .neq("status", "cancelled")
      .order("departure_time", { ascending: true }),
  ]);

  if (stationsError) throw stationsError;
  if (routesError) throw routesError;
  if (tripsError) throw tripsError;

  const stationByCode = Object.fromEntries((stations || []).map((station) => [station.code, station]));
  const route = (routes || []).find(
    (item) =>
      item.origin_station_id === stationByCode[originCode]?.id &&
      item.destination_station_id === stationByCode[destinationCode]?.id,
  );

  if (!route) return [];

  return (trips || [])
    .filter((trip) => trip.route_id === route.id)
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

  const { data, error } = await supabase.rpc("create_public_booking", {
    p_trip_id: tripId,
    p_buyer_name: fullName,
    p_buyer_email: buyer.email,
    p_buyer_phone: buyer.phone,
    p_passenger_count: passengerCount,
    p_seat_number: seatNumber,
    p_luggage: Boolean(extras.luggage),
    p_insurance: Boolean(extras.insurance),
    p_payment_method: paymentMethod,
  });

  if (error) throw error;

  return Array.isArray(data) ? data[0] : data;
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
