import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Bus, Clock3, MapPinned, Plane } from "lucide-react";
import { stops } from "../data/content.js";

function markerIcon(html, size) {
  return L.divIcon({
    html,
    className: "route-marker-wrap",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function stopIcon(stop) {
  const Icon = stop.type === "airport" ? Plane : Bus;
  const html = renderToStaticMarkup(
    <span className={`route-marker ${stop.type}`}>
      <Icon size={16} />
    </span>,
  );
  return markerIcon(html, 34);
}

function FocusStop({ stop }) {
  const map = useMap();
  useEffect(() => {
    map.setView([stop.lat, stop.lng], 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.id]);
  return null;
}

function ActiveStopMarker({ stop, t }) {
  const markerRef = useRef(null);

  useEffect(() => {
    markerRef.current?.openPopup();
  }, []);

  return (
    <Marker icon={stopIcon(stop)} position={[stop.lat, stop.lng]} ref={markerRef}>
      <Popup autoPan={false} closeButton={false}>
        <strong>{stop.title}</strong>
        <br />
        {stop.meta}
        <br />
        {stop.directions}
        <br />
        {t.stopArriveBefore.replace("{minutes}", stop.arriveMinutesBefore)}
      </Popup>
    </Marker>
  );
}

export default function StopsSection({ dark, t }) {
  const [activeStop, setActiveStop] = useState(stops[0]);

  const tileUrl = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileAttribution = dark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <section className="section stops-section" id="stops">
      <div className="section-heading narrow">
        <div>
          <p className="eyebrow">{t.stops}</p>
          <h2>{t.stopsLead}</h2>
        </div>
      </div>

      <div className="stops-compact-layout">
        <div className="stop-cards-list">
          {stops.map((stop) => (
            <button
              className={activeStop.id === stop.id ? "stop-card active" : "stop-card"}
              key={stop.id}
              type="button"
              onClick={() => setActiveStop(stop)}
            >
              <MapPinned size={18} />
              <span>
                <strong>{stop.title}</strong>
                <small>{stop.meta}</small>
                <small className="stop-arrive">
                  <Clock3 size={13} />
                  {t.stopArriveBefore.replace("{minutes}", stop.arriveMinutesBefore)}
                </small>
                <small>{stop.directions}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="stop-map-live">
          <MapContainer
            center={[activeStop.lat, activeStop.lng]}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
            zoom={15}
          >
            <TileLayer attribution={tileAttribution} url={tileUrl} />
            <FocusStop stop={activeStop} />
            <ActiveStopMarker key={activeStop.id} stop={activeStop} t={t} />
          </MapContainer>
        </div>
      </div>
    </section>
  );
}
