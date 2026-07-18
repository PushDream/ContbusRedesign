import { useMemo } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { Bus, Plane } from "lucide-react";
import { departureTimes, estimateArrival, getRouteStopsForFare, stops } from "../data/content.js";
import { useTripProgress } from "../lib/useTripProgress.js";
import { interpolateAlongRoute } from "../lib/geo.js";

const LUBLIN_STOP_IDS = new Set(["lublin", "tysiaclecia"]);

function markerIcon(html, size) {
  return L.divIcon({
    html,
    className: "route-marker-wrap",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function stopIcon(stop, onActiveRoute) {
  const Icon = stop.type === "airport" ? Plane : Bus;
  const html = renderToStaticMarkup(
    <span className={`route-marker ${stop.type}${onActiveRoute ? " route-marker-active" : ""}`}>
      <Icon size={16} />
    </span>,
  );
  return markerIcon(html, 34);
}

function busIcon() {
  const html = renderToStaticMarkup(
    <span className="route-marker route-marker-bus">
      <Bus size={16} />
    </span>,
  );
  return markerIcon(html, 32);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function nextDepartureLabel(stop) {
  const times = LUBLIN_STOP_IDS.has(stop.id) ? departureTimes : departureTimes.map(estimateArrival);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  return times.find((time) => toMinutes(time) > nowMinutes) || times[0];
}

export default function RouteMapSection({ activeFare, dark, t }) {
  const bounds = useMemo(() => L.latLngBounds(stops.map((stop) => [stop.lat, stop.lng])), []);
  const routeStops = useMemo(() => getRouteStopsForFare(activeFare), [activeFare]);
  const routePositions = useMemo(
    () => routeStops.map((stop) => [stop.lat, stop.lng]),
    [routeStops],
  );
  const progress = useTripProgress(activeFare.durationMinutes);
  const busPosition = useMemo(
    () => interpolateAlongRoute(routePositions, progress),
    [routePositions, progress],
  );

  const tileUrl = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileAttribution = dark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <section className="section route-map-section" id="route-map">
      <div className="section-heading narrow">
        <div>
          <p className="eyebrow">{t.routeMapTitle}</p>
          <h2>{t.routeMapLead}</h2>
        </div>
      </div>

      <div className="route-map-canvas">
        <MapContainer
          bounds={bounds}
          boundsOptions={{ padding: [32, 32] }}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer attribution={tileAttribution} url={tileUrl} />

          <Polyline
            pathOptions={{ color: dark ? "#22c479" : "#008a3d", weight: 4, opacity: 0.85 }}
            positions={stops.map((stop) => [stop.lat, stop.lng])}
          />

          {stops.map((stop) => (
            <Marker
              icon={stopIcon(stop, routeStops.includes(stop))}
              key={stop.id}
              position={[stop.lat, stop.lng]}
            >
              <Popup>
                <strong>{stop.title}</strong>
                <br />
                {t.routeMapNextDeparture}: {nextDepartureLabel(stop)}
              </Popup>
            </Marker>
          ))}

          <Marker icon={busIcon()} position={busPosition} zIndexOffset={1000}>
            <Popup>
              {activeFare.from} → {activeFare.to}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </section>
  );
}
