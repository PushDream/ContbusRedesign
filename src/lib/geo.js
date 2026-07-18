const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Walks a polyline of [lat, lng] points and returns the [lat, lng] that sits
// `progress` (0-1) of the way along it, by real distance rather than by index.
export function interpolateAlongRoute(points, progress) {
  if (points.length === 1) return points[0];

  const segmentLengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const length = haversineKm(points[i], points[i + 1]);
    segmentLengths.push(length);
    total += length;
  }

  let target = total * progress;
  for (let i = 0; i < segmentLengths.length; i += 1) {
    const length = segmentLengths[i];
    if (target <= length || i === segmentLengths.length - 1) {
      const ratio = length === 0 ? 0 : Math.min(1, target / length);
      const [lat1, lng1] = points[i];
      const [lat2, lng2] = points[i + 1];
      return [lat1 + (lat2 - lat1) * ratio, lng1 + (lng2 - lng1) * ratio];
    }
    target -= length;
  }

  return points[points.length - 1];
}
