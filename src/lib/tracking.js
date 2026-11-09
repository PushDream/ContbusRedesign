// Turns a bus position into what a passenger needs to know. The same rules as
// the customer app's src/utils/tracking.js, so the website and the app always
// agree about where a bus is. Pure functions, so they can be tested without a
// live trip.

// Stops are at the street level of each terminal. The corridors follow the main
// roads closely enough to measure progress along them. They are not turn-by-turn
// road geometry.
const STOPS = {
  lublin: { latitude: 51.2312, longitude: 22.5677 },
  warsaw: { latitude: 52.2283, longitude: 21.004 },
  chopin: { latitude: 52.1657, longitude: 20.9671 },
  modlin: { latitude: 52.4502, longitude: 20.6519 },
};

const S17_CORRIDOR = [
  { latitude: 51.393, longitude: 22.186 },
  { latitude: 51.625, longitude: 21.933 },
  { latitude: 51.897, longitude: 21.615 },
  { latitude: 52.207, longitude: 21.18 },
];
const S2_TO_CHOPIN = [{ latitude: 52.16, longitude: 21.05 }];
const NORTH_TO_MODLIN = [{ latitude: 52.335, longitude: 20.885 }];
const WEST_TO_MODLIN = [
  { latitude: 52.25, longitude: 20.9 },
  { latitude: 52.335, longitude: 20.885 },
];

const CORRIDORS = {
  "lublin-warsaw": S17_CORRIDOR,
  "lublin-chopin": [...S17_CORRIDOR, ...S2_TO_CHOPIN],
  "lublin-modlin": [...S17_CORRIDOR, STOPS.warsaw, ...NORTH_TO_MODLIN],
  "warsaw-modlin": NORTH_TO_MODLIN,
  "chopin-modlin": WEST_TO_MODLIN,
  "chopin-warsaw": [],
};

export const STALE_AFTER_MS = 2 * 60 * 1000;

const RUNNING_STATUSES = ["boarding", "departed", "delayed"];
const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

// The booking only names its stations, so match them to the stops above. The
// airports come first because "Lotnisko Chopina" is in Warsaw too.
export function stopIdForStation(name) {
  const text = String(name || "").toLowerCase();
  if (text.includes("modlin")) return "modlin";
  if (text.includes("chopin")) return "chopin";
  if (text.includes("lublin")) return "lublin";
  if (text.includes("warszawa") || text.includes("warsaw")) return "warsaw";
  return null;
}

export function distanceKm(from, to) {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Returns null for a stop with no known location, so the page leaves the
// position out instead of drawing it in the wrong place.
export function routePath(fromId, toId) {
  const from = STOPS[fromId];
  const to = STOPS[toId];
  if (!from || !to) return null;

  const forward = CORRIDORS[`${fromId}-${toId}`];
  if (forward) return [from, ...forward, to];

  const backward = CORRIDORS[`${toId}-${fromId}`];
  if (backward) return [from, ...[...backward].reverse(), to];

  return [from, to];
}

function projectOntoSegment(point, start, end) {
  // Longitude degrees shrink towards the poles, so scale them to stay close to
  // true distance at Polish latitudes.
  const scale = Math.cos(toRadians(point.latitude));
  const segmentX = (end.longitude - start.longitude) * scale;
  const segmentY = end.latitude - start.latitude;
  const pointX = (point.longitude - start.longitude) * scale;
  const pointY = point.latitude - start.latitude;
  const lengthSquared = segmentX ** 2 + segmentY ** 2;
  const ratio = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (pointX * segmentX + pointY * segmentY) / lengthSquared));

  return {
    ratio,
    latitude: start.latitude + (end.latitude - start.latitude) * ratio,
    longitude: start.longitude + (end.longitude - start.longitude) * ratio,
  };
}

// Finds the nearest point on the route and how far along the route it sits.
export function progressAlongPath(path, point) {
  const lengths = path.slice(1).map((stop, index) => distanceKm(path[index], stop));
  const totalKm = lengths.reduce((sum, length) => sum + length, 0);
  let best = null;
  let travelledBefore = 0;

  lengths.forEach((length, index) => {
    const projected = projectOntoSegment(point, path[index], path[index + 1]);
    const offRouteKm = distanceKm(point, projected);
    if (!best || offRouteKm < best.offRouteKm) {
      best = {
        offRouteKm,
        fraction: totalKm === 0 ? 1 : (travelledBefore + length * projected.ratio) / totalKm,
        snapped: { latitude: projected.latitude, longitude: projected.longitude },
        segmentIndex: index,
      };
    }
    travelledBefore += length;
  });

  return { ...best, remainingKm: totalKm * (1 - best.fraction), totalKm };
}

export function deriveTracking({ live, path, durationMinutes, now = Date.now() }) {
  if (!live) return { phase: "unknown" };

  const { status } = live;
  if (status === "cancelled") return { phase: "cancelled", status };
  if (status === "arrived") return { phase: "arrived", status };
  if (!RUNNING_STATUSES.includes(status)) return { phase: "scheduled", status };

  const delayed = status === "delayed";
  const boarding = status === "boarding";
  if (live.latitude == null || live.longitude == null) {
    return { phase: "waiting", status, delayed, boarding };
  }

  const ageMs = Math.max(0, now - new Date(live.recordedAt).getTime());
  const position = { latitude: live.latitude, longitude: live.longitude };
  const progress = path ? progressAlongPath(path, position) : null;
  const shared = { status, delayed, boarding, ageMs, position, progress };

  if (ageMs > STALE_AFTER_MS) return { phase: "stale", ...shared };

  // The timetable's duration is the honest basis for this: there is no traffic
  // data, so remaining distance is converted at the trip's scheduled pace.
  const etaMinutes =
    progress && durationMinutes ? Math.max(1, Math.round(durationMinutes * (1 - progress.fraction))) : null;

  return { phase: "live", ...shared, etaMinutes };
}

export function shouldPoll({ phase }) {
  return phase !== "cancelled" && phase !== "arrived";
}
