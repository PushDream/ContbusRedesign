import { fares } from "../data/content.js";
import { supabase } from "./supabase.js";

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

export async function fetchDepartures({ from, to, date }) {
  const originCode = stationCodeByName[from];
  const destinationCode = stationCodeByName[to];
  const departureDate = toDateOnly(date);

  if (!originCode || !destinationCode || originCode === destinationCode) {
    return [];
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
